// The v2 AI client through the Vercel AI SDK and the OpenAI provider: structured-output calls
// (optionally with up to 4 image links) and chat calls with tools the model may propose but never
// runs. 30-second timeout, one retry on any failure (timeout, network, API error or an answer that
// fails the schema), and one log line per call with ids, model, tokens, time and outcome, never any
// prompt, answer or image link. Errors carry no model text.

import { createOpenAI } from '@ai-sdk/openai';
import { APICallError, generateText, Output, tool, type LanguageModel, type ModelMessage, type UserContent } from 'ai';
import type { z } from 'zod';

import type { ChatSpec, PromptSpec } from './prompt.ts';

export type AiErrorCode = 'config' | 'upstream';

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

/** A tool the model may call. It has no execute: the caller decides what a call does. */
export interface ChatTool {
  description: string;
  inputSchema: z.ZodTypeAny;
}

export type ChatToolCall<T extends Record<string, ChatTool>> = {
  [K in keyof T & string]: { name: K; input: z.infer<T[K]['inputSchema']> };
}[keyof T & string];

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiClient {
  readonly modelId: string;
  /** False when there is no key (and no test model): every call would be a config error. */
  readonly configured: boolean;
  generate<I, O>(
    spec: PromptSpec<I, O>,
    input: I,
    opts?: { extra?: string; images?: URL[] },
  ): Promise<{ output: O; usage: AiUsage }>;
  chat<I, T extends Record<string, ChatTool>>(
    spec: ChatSpec<I>,
    input: I,
    opts: { history: ChatTurn[]; message: string; tools: T },
  ): Promise<{ text: string; toolCalls: Array<ChatToolCall<T>>; usage: AiUsage }>;
}

type Log = { info(message: string): void; warn(message: string): void };

const TIMEOUT_MS = 30_000;
const ATTEMPTS = 2;
export const MAX_IMAGES = 4;

export function createAi(opts: { apiKey: string | undefined; modelId: string; log?: Log; model?: LanguageModel }): AiClient {
  const log: Log = opts.log ?? { info: (m) => console.info(m), warn: (m) => console.warn(m) };
  let model = opts.model ?? null;

  const requireModel = (): LanguageModel => {
    if (model) return model;
    if (!opts.apiKey) throw new AiError('config', 'AI is not configured');
    model = createOpenAI({ apiKey: opts.apiKey })(opts.modelId);
    return model;
  };

  /** Runs one call with the retry rule and the log line; `run` returns the token usage it saw. */
  async function withRetry<R>(spec: { id: string; version: number }, run: () => Promise<{ result: R; usage: AiUsage }>) {
    const started = Date.now();
    const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
    const line = (outcome: string) =>
      `ai call prompt=${spec.id}@v${spec.version} model=${opts.modelId} in=${usage.inputTokens} out=${usage.outputTokens} ms=${Date.now() - started} outcome=${outcome}`;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const { result, usage: used } = await run();
        usage.inputTokens += used.inputTokens;
        usage.outputTokens += used.outputTokens;
        log.info(line(attempt === 1 ? 'ok' : 'retried'));
        return { result, usage };
      } catch (err) {
        // A 4xx (bad key, unknown model, bad request) will not get better on a retry.
        const status = APICallError.isInstance(err) ? err.statusCode : undefined;
        const final = attempt === ATTEMPTS || (status !== undefined && status >= 400 && status < 500);
        if (final) {
          // The error name and status only: an API error message can carry response text.
          const name = err instanceof Error ? err.name : 'unknown';
          log.warn(`${line('failed')} error=${name}${status !== undefined ? ` status=${status}` : ''}`);
          throw new AiError('upstream', 'The AI service did not give a usable answer');
        }
      }
    }
    throw new AiError('upstream', 'The AI service did not give a usable answer');
  }

  const usageOf = (u: { inputTokens?: number; outputTokens?: number }): AiUsage => ({
    inputTokens: u.inputTokens ?? 0,
    outputTokens: u.outputTokens ?? 0,
  });

  return {
    modelId: opts.modelId,
    configured: Boolean(opts.model || opts.apiKey),

    async generate(spec, input, extra = {}) {
      const lm = requireModel();
      const text = extra.extra ? `${spec.render(input)}\n\n${extra.extra}` : spec.render(input);
      const images = (extra.images ?? []).slice(0, MAX_IMAGES);
      const content: UserContent = [{ type: 'text', text }, ...images.map((data) => ({ type: 'file' as const, data, mediaType: 'image' }))];
      const { result, usage } = await withRetry(spec, async () => {
        const r = await generateText({
          model: lm,
          instructions: spec.instructions,
          ...(images.length ? { messages: [{ role: 'user' as const, content }] } : { prompt: text }),
          output: Output.object({ schema: spec.schema }),
          timeout: TIMEOUT_MS,
          maxRetries: 0,
        });
        return { result: r.output as Awaited<ReturnType<typeof spec.schema.parse>>, usage: usageOf(r.usage) };
      });
      return { output: result, usage };
    },

    async chat(spec, input, { history, message, tools }) {
      const lm = requireModel();
      const messages: ModelMessage[] = [
        { role: 'user', content: spec.render(input) },
        ...history.map((t): ModelMessage => (t.role === 'user' ? { role: 'user', content: t.content } : { role: 'assistant', content: t.content })),
        { role: 'user', content: message },
      ];
      const sdkTools = Object.fromEntries(
        Object.entries(tools).map(([name, t]) => [name, tool({ description: t.description, inputSchema: t.inputSchema })]),
      );
      const { result, usage } = await withRetry(spec, async () => {
        const r = await generateText({ model: lm, instructions: spec.instructions, messages, tools: sdkTools, timeout: TIMEOUT_MS, maxRetries: 0 });
        return { result: r, usage: usageOf(r.usage) };
      });

      // The SDK may already mark a bad call; parse again so only schema-valid inputs come back.
      const toolCalls: Array<ChatToolCall<typeof tools>> = [];
      for (const call of result.toolCalls) {
        const t = Object.prototype.hasOwnProperty.call(tools, call.toolName) ? tools[call.toolName] : undefined;
        const parsed = t && !('invalid' in call && call.invalid) ? t.inputSchema.safeParse(call.input) : undefined;
        if (parsed?.success) toolCalls.push({ name: call.toolName, input: parsed.data } as ChatToolCall<typeof tools>);
        else log.warn(`ai tool dropped name=${t ? call.toolName : 'unknown'} prompt=${spec.id}@v${spec.version}`);
      }
      return { text: result.text, toolCalls, usage };
    },
  };
}
