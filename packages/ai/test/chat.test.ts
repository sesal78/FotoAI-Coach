import { expect, test } from 'vitest';
import { z } from 'zod';

import { createAi, type ChatSpec, type PromptSpec } from '../src/index.ts';
import { mockChatModel, mockModel } from './support/mock-model.ts';

const spec: PromptSpec<{ subject: string }, { idea: string }> = {
  id: 'img-test',
  version: 1,
  instructions: 'Describe the photo. Answer in JSON.',
  render: (input) => `Subject: ${input.subject}`,
  schema: z.object({ idea: z.string() }),
};

const coachSpec: ChatSpec<{ screen: string }> = {
  id: 'chat-test',
  version: 2,
  instructions: 'You are a coach. Use tools to propose things.',
  render: (input) => `Context: the user is on ${input.screen}.`,
};

const tools = {
  proposeChallenge: { description: 'Propose a challenge', inputSchema: z.object({ challengeText: z.string().min(1) }) },
};

const logsOf = () => {
  const logs: string[] = [];
  return { logs, log: { info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m) } };
};
const IMG = (n: number) => new URL(`https://storage.example/object/sign/fotoai-submissions/u/photos/p/${n}.jpg?token=secret${n}`);

test('images go into the user message as image parts, at most 4', async () => {
  const model = mockModel([JSON.stringify({ idea: 'x' })]);
  const ai = createAi({ apiKey: 'sk', modelId: 'gpt-6-luna', model, log: logsOf().log });
  await ai.generate(spec, { subject: 'trees' }, { images: [IMG(1), IMG(2), IMG(3), IMG(4), IMG(5)] });
  const user = model.doGenerateCalls[0]!.prompt.find((m) => m.role === 'user')!;
  const parts = user.content as Array<{ type: string }>;
  expect(parts.filter((p) => p.type === 'file' || p.type === 'image')).toHaveLength(4);
  expect(JSON.stringify(parts)).toContain('Subject: trees');
});

test('the log line never contains an image URL', async () => {
  const { logs, log } = logsOf();
  const ai = createAi({ apiKey: 'sk', modelId: 'gpt-6-luna', model: mockModel([JSON.stringify({ idea: 'x' })]), log });
  await ai.generate(spec, { subject: 'trees' }, { images: [IMG(1)] });
  expect(logs.join('\n')).not.toMatch(/storage\.example|secret1/);
});

test('chat sends the context, then the history, then the new message, all as user/assistant messages', async () => {
  const model = mockChatModel({ text: 'Try a long exposure.' });
  const ai = createAi({ apiKey: 'sk', modelId: 'gpt-6-luna', model, log: logsOf().log });
  const out = await ai.chat(coachSpec, { screen: 'shoot' }, {
    history: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
    message: 'what next?',
    tools,
  });
  expect(out.text).toBe('Try a long exposure.');
  expect(out.toolCalls).toEqual([]);
  const prompt = model.doGenerateCalls[0]!.prompt;
  const flat = prompt.map((m) => `${m.role}:${JSON.stringify(m.content)}`);
  expect(flat[0]).toMatch(/^system:.*You are a coach/);
  expect(flat[1]).toMatch(/^user:.*the user is on shoot/);
  expect(flat[2]).toMatch(/^user:.*hi/);
  expect(flat[3]).toMatch(/^assistant:.*hello/);
  expect(flat[4]).toMatch(/^user:.*what next\?/);
  expect(JSON.stringify(prompt.filter((m) => m.role === 'system'))).not.toMatch(/shoot|what next/);
});

test('a tool call comes back with its parsed input; a call that fails its schema is dropped', async () => {
  const { logs, log } = logsOf();
  const model = mockChatModel({
    text: 'Here is one.',
    toolCalls: [
      { name: 'proposeChallenge', input: { challengeText: 'Shoot a reflection at blue hour' } },
      { name: 'proposeChallenge', input: { challengeText: '' } },
    ],
  });
  const ai = createAi({ apiKey: 'sk', modelId: 'gpt-6-luna', model, log });
  const out = await ai.chat(coachSpec, { screen: 'today' }, { history: [], message: 'give me a challenge', tools });
  expect(out.toolCalls).toEqual([{ name: 'proposeChallenge', input: { challengeText: 'Shoot a reflection at blue hour' } }]);
  expect(logs.some((l) => /tool dropped name=proposeChallenge/.test(l))).toBe(true);
});

test('chat with no key is a config error and no call', async () => {
  const ai = createAi({ apiKey: undefined, modelId: 'gpt-6-luna' });
  await expect(ai.chat(coachSpec, { screen: 'me' }, { history: [], message: 'hi', tools })).rejects.toMatchObject({ code: 'config' });
});
