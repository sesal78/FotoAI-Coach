import { MockLanguageModelV4 } from 'ai/test';

// Like the OpenAI provider: https image links go to the model as links, not downloads.
const OPENAI_URLS = { 'image/*': [/^https?:\/\/.*$/] };

export type Answer = string | Error;

/** A mock model that gives the answers in order (the last one repeats) and records each call. */
export function mockModel(answers: Answer[]) {
  const queue = [...answers];
  return new MockLanguageModelV4({
    supportedUrls: OPENAI_URLS,
    doGenerate: async () => {
      const next = queue.length > 1 ? queue.shift()! : queue[0]!;
      if (next instanceof Error) throw next;
      return {
        content: [{ type: 'text', text: next }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 120, noCache: 120, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 30, text: 30, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}

/** A mock model that answers every call with this text and these tool calls. */
export function mockChatModel(reply: { text?: string; toolCalls?: Array<{ name: string; input: unknown }> }) {
  return new MockLanguageModelV4({
    supportedUrls: OPENAI_URLS,
    doGenerate: async () => ({
      content: [
        ...(reply.text ? [{ type: 'text' as const, text: reply.text }] : []),
        ...(reply.toolCalls ?? []).map((c, i) => ({ type: 'tool-call' as const, toolCallId: `call-${i}`, toolName: c.name, input: JSON.stringify(c.input) })),
      ],
      finishReason: { unified: reply.toolCalls?.length ? ('tool-calls' as const) : ('stop' as const), raw: undefined },
      usage: {
        inputTokens: { total: 200, noCache: 200, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 40, text: 40, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}
