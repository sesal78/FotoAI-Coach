// A new challenge draft for Today, cut to the live app's column limits (challengeRowFromLlm).

import { AiError, type AiClient } from './client.ts';
import { CHALLENGE_V1, type ChallengeInput } from './prompts/challenge.v1.ts';

export interface ChallengeDraft {
  challengeText: string;
  category: string | null;
  difficulty: string | null;
  duration: string | null;
  tips: string | null;
  recommendedGear: string[];
  shotList: string[];
  narrativeContext: string | null;
  editingDirection: string | null;
  masteryArea: string | null;
  technicalLevel: number | null;
  successCriteria: string | null;
  whatToLookFor: string | null;
  prompt: { id: string; version: number };
}

const clip = (text: string | null, max: number) => (text?.trim() ? text.trim().slice(0, max) : null);
const clipList = (items: string[] | null, maxItems: number, max: number) =>
  (items ?? []).map((item) => item.trim()).filter(Boolean).slice(0, maxItems).map((item) => item.slice(0, max));

/** Throws AiError('upstream') when the answer has no challenge text. */
export async function generateChallenge(ai: AiClient, input: ChallengeInput): Promise<ChallengeDraft> {
  const { output } = await ai.generate(CHALLENGE_V1, input);
  const challengeText = clip(output.challengeText, 4000);
  if (!challengeText) throw new AiError('upstream', 'The challenge generator returned no challenge');
  return {
    challengeText,
    category: clip(output.category, 60),
    difficulty: clip(output.difficulty, 60),
    duration: clip(output.duration, 60),
    tips: clip(output.tips, 4000),
    recommendedGear: clipList(output.recommendedGear, 20, 200),
    shotList: clipList(output.shotList, 20, 500),
    narrativeContext: clip(output.narrativeContext, 4000),
    editingDirection: clip(output.editingDirection, 4000),
    masteryArea: clip(output.masteryArea, 200),
    technicalLevel: output.technicalLevel,
    successCriteria: clip(output.successCriteria, 4000),
    whatToLookFor: clip(output.whatToLookFor, 4000),
    prompt: { id: CHALLENGE_V1.id, version: CHALLENGE_V1.version },
  };
}
