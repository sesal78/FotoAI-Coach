// The check on one uploaded photo, from a short signed read link. The answer is the model's,
// clipped to the schema; with no brief, matchesBrief is always null.

import type { AiClient } from './client.ts';
import { PHOTO_CHECK_V1, type PhotoCheckInput, type PhotoCheckOutput } from './prompts/photo-check.v1.ts';

export interface PhotoCheck extends PhotoCheckOutput {
  prompt: { id: string; version: number };
}

export async function checkPhoto(ai: AiClient, input: PhotoCheckInput, image: URL): Promise<PhotoCheck> {
  const { output } = await ai.generate(PHOTO_CHECK_V1, input, { images: [image] });
  return {
    safe: output.safe,
    matchesBrief: input.brief ? output.matchesBrief : null,
    genre: output.genre,
    prompt: { id: PHOTO_CHECK_V1.id, version: PHOTO_CHECK_V1.version },
  };
}
