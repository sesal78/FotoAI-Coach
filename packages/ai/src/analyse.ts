// Analyse one photo from a short signed read link: a critique, editing tips or how to recreate it.
// The answer is the model's, cut to fixed lengths; nothing here is stored.

import type { AiClient } from './client.ts';
import { CRITIQUE_V1, type CritiqueOutput } from './prompts/critique.v1.ts';
import { EDITING_V1, type EditingOutput } from './prompts/editing.v1.ts';
import type { AnalyseInput } from './prompts/photo-context.ts';
import { RECREATE_V1, type RecreateOutput } from './prompts/recreate.v1.ts';

export type AnalysisMode = 'critique' | 'editing' | 'recreate';

export type Analysis = { prompt: { id: string; version: number } } & (
  | { mode: 'critique'; critique: CritiqueOutput }
  | { mode: 'editing'; editing: EditingOutput }
  | { mode: 'recreate'; recreate: RecreateOutput }
);

const cut = (text: string, max: number) => text.trim().slice(0, max);
const cutList = (items: string[], maxItems: number, max: number) => items.slice(0, maxItems).map((item) => cut(item, max));
const promptOf = (spec: { id: string; version: number }) => ({ id: spec.id, version: spec.version });

export async function analysePhoto(ai: AiClient, mode: AnalysisMode, input: AnalyseInput, image: URL): Promise<Analysis> {
  const images = [image];
  if (mode === 'critique') {
    const { output: o } = await ai.generate(CRITIQUE_V1, input, { images });
    return {
      mode,
      prompt: promptOf(CRITIQUE_V1),
      critique: {
        ...o,
        technicalFeedback: cut(o.technicalFeedback, 2000),
        compositionFeedback: cut(o.compositionFeedback, 2000),
        creativeFeedback: cut(o.creativeFeedback, 2000),
        strengths: cutList(o.strengths, 5, 200),
        improvements: cutList(o.improvements, 5, 200),
        suggestedSettings: o.suggestedSettings ? cut(o.suggestedSettings, 500) : null,
      },
    };
  }
  if (mode === 'editing') {
    const { output: o } = await ai.generate(EDITING_V1, input, { images });
    return {
      mode,
      prompt: promptOf(EDITING_V1),
      editing: {
        summary: cut(o.summary, 600),
        steps: o.steps.slice(0, 8).map((s) => ({ tool: cut(s.tool, 80), change: cut(s.change, 200), why: cut(s.why, 500) })),
        filmSimulation: o.filmSimulation ? cut(o.filmSimulation, 120) : null,
      },
    };
  }
  const { output: o } = await ai.generate(RECREATE_V1, input, { images });
  const s = o.estimatedSettings;
  const l = o.lightingAnalysis;
  return {
    mode,
    prompt: promptOf(RECREATE_V1),
    recreate: {
      estimatedSettings: { iso: cut(s.iso, 60), aperture: cut(s.aperture, 60), shutterSpeed: cut(s.shutterSpeed, 60), focalLength: cut(s.focalLength, 60), meteringMode: cut(s.meteringMode, 60) },
      lightingAnalysis: { timeOfDay: cut(l.timeOfDay, 200), lightType: cut(l.lightType, 200), lightDirection: cut(l.lightDirection, 200), modifiers: cut(l.modifiers, 200) },
      cameraPosition: cut(o.cameraPosition, 500),
      lensType: cut(o.lensType, 300),
      postProcessing: cut(o.postProcessing, 1000),
      shotRecipe: cutList(o.shotRecipe, 10, 400),
      difficultyToRecreate: o.difficultyToRecreate,
      gearNeeded: cutList(o.gearNeeded, 10, 120),
    },
  };
}
