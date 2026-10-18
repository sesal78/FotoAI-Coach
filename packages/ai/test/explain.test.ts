import { lightTimes } from '@fotoai/core';
import { expect, test } from 'vitest';

import { assertStrictSchema, createAi, explainPlace, PLACE_EXPLAIN_V1 } from '../src/index.ts';
import { mockModel } from './support/mock-model.ts';

const light = lightTimes(-37.818, 144.969, '2026-10-18');
const ANSWER = JSON.stringify({ bestLight: 'Late golden hour from the west.', angles: ['Low from the steps', 'Wide from the river', 'Tight on the facade', 'a fourth one'], caution: null });

function setup(answer = ANSWER) {
  const model = mockModel([answer]);
  const ai = createAi({ apiKey: 'sk-test', modelId: 'gpt-6-luna', model, log: { info: () => undefined, warn: () => undefined } });
  return { ai, model, prompt: () => JSON.stringify(model.doGenerateCalls[0]!.prompt.filter((m) => m.role === 'user')) };
}

test('the prompt holds only the Google facts given: name and types, no address or reviews', async () => {
  const { ai, prompt } = setup();
  const result = await explainPlace(ai, {
    place: { kind: 'google', placeId: 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ', name: 'Federation Square', types: ['tourist_attraction', 'plaza'], location: { lat: -37.818, lng: 144.969 } },
    light,
    weather: null,
  });
  expect(prompt()).toContain('Federation Square');
  expect(prompt()).toContain('tourist_attraction, plaza');
  expect(prompt()).not.toMatch(/address|review|rating/i);
  expect(result).toMatchObject({ bestLight: 'Late golden hour from the west.', caution: null, prompt: { id: PLACE_EXPLAIN_V1.id, version: PLACE_EXPLAIN_V1.version } });
  expect(result.angles).toHaveLength(3);
});

test("a pin's prompt holds only its name, notes, coordinates, light and weather", async () => {
  const { ai, prompt } = setup();
  await explainPlace(ai, { place: { kind: 'pin', name: 'Point Ormond lookout', notes: 'faces west over the bay', location: { lat: -37.8836, lng: 144.9862 } }, light, weather: null });
  expect(prompt()).toContain('user-provided');
  expect(prompt()).toContain('faces west over the bay');
  expect(prompt()).toContain('-37.8836, 144.9862');
  expect(prompt()).toContain('weather unavailable');
});

test('a pin with no notes asks for light-and-weather advice only', async () => {
  const { ai, prompt } = setup();
  await explainPlace(ai, { place: { kind: 'pin', name: 'Lookout', notes: null, location: { lat: -37.88, lng: 144.98 } }, light, weather: null });
  expect(prompt()).toContain('No notes: speak only about the light and the weather.');
});

test('long answers are cut to the limits; the schema is strict', async () => {
  const { ai } = setup(JSON.stringify({ bestLight: 'x'.repeat(500), angles: ['y'.repeat(300)], caution: 'z'.repeat(300) }));
  const result = await explainPlace(ai, { place: { kind: 'pin', name: 'Lookout', notes: null, location: { lat: -37.88, lng: 144.98 } }, light, weather: null });
  expect(result.bestLight).toHaveLength(300);
  expect(result.angles[0]).toHaveLength(200);
  expect(result.caution).toHaveLength(200);
  expect(() => assertStrictSchema(PLACE_EXPLAIN_V1.schema)).not.toThrow();
});
