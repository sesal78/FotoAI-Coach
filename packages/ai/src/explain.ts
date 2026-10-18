// Best light and angles for a place. The answer is returned, never stored.

import type { AiClient } from './client.ts';
import { PLACE_EXPLAIN_V1, type ExplainInput } from './prompts/place-explain.v1.ts';

export interface PlaceExplanation {
  bestLight: string;
  angles: string[];
  caution: string | null;
  prompt: { id: string; version: number };
}

const cut = (text: string, max: number) => text.trim().slice(0, max);

export async function explainPlace(ai: AiClient, input: ExplainInput): Promise<PlaceExplanation> {
  const { output } = await ai.generate(PLACE_EXPLAIN_V1, input);
  return {
    bestLight: cut(output.bestLight, 300),
    angles: output.angles.slice(0, 3).map((a) => cut(a, 200)),
    caution: output.caution ? cut(output.caution, 200) : null,
    prompt: { id: PLACE_EXPLAIN_V1.id, version: PLACE_EXPLAIN_V1.version },
  };
}
