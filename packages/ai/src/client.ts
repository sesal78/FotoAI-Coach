// The v2 AI client: one structured-output call per prompt through the Vercel AI SDK and the
// OpenAI provider. 30-second timeout, one retry on any failure (timeout, network, API error or
// an answer that fails the schema), and one log line per call with ids, model, tokens, time and
// outcome, never any prompt or answer text. Errors carry no model text.

import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output, type LanguageModel } from 'ai';

import type { PromptSpec } from './prompt.ts';

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

export interface AiClient {
  readonly modelId: string;
  generate<I, O>(spec: PromptSpec<I, O>, input: I, opts?: { extra?: string }): Promise<{ output: O; usage: AiUsage }>;
}

type Log = { info(message: string): void; warn(message: string): void };

const TIMEOUT_MS = 30_000;
const ATTEMPTS = 2;

export function createAi(opts: { apiKey: string | undefined; modelId: string; log?: Log; model?: LanguageModel }): AiClient {
  const log: Log = opts.log ?? { info: (m) => console.info(m), warn: (m) => console.warn(m) };
  let model = opts.model ?? null;

  const requireModel = (): LanguageModel => {
    if (model) return model;
    if (!opts.apiKey) throw new AiError('config', 'AI is not configured');
    model = createOpenAI({ apiKey: opts.apiKey })(opts.modelId);
    return model;
  };

  return {
    modelId: opts.modelId,
    async generate(spec, input, extra = {}) {
      const lm = requireModel();
      const prompt = extra.extra ? `${spec.render(input)}\n\n${extra.extra}` : spec.render(input);
      const started = Date.now();
      const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
      const line = (outcome: string) =>
        `ai call prompt=${spec.id}@v${spec.version} model=${opts.modelId} in=${usage.inputTokens} out=${usage.outputTokens} ms=${Date.now() - started} outcome=${outcome}`;

      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        try {
          const result = await generateText({
            model: lm,
            instructions: spec.instructions,
            prompt,
            output: Output.object({ schema: spec.schema }),
            timeout: TIMEOUT_MS,
            maxRetries: 0,
          });
          usage.inputTokens += result.usage.inputTokens ?? 0;
          usage.outputTokens += result.usage.outputTokens ?? 0;
          const output = result.output as Awaited<ReturnType<typeof spec.schema.parse>>;
          log.info(line(attempt === 1 ? 'ok' : 'retried'));
          return { output, usage };
        } catch {
          if (attempt === ATTEMPTS) {
            log.warn(line('failed'));
            throw new AiError('upstream', 'The AI service did not give a usable answer');
          }
        }
      }
      throw new AiError('upstream', 'The AI service did not give a usable answer');
    },
  };
}
