import { MockLanguageModelV4 } from 'ai/test';

export type Answer = string | Error;

/** A mock model that gives the answers in order (the last one repeats) and records each call. */
export function mockModel(answers: Answer[]) {
  const queue = [...answers];
  return new MockLanguageModelV4({
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
