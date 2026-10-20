// Analyse on a v2 photo: POST /api/v2/photos/:id/analyse and GET /api/v2/photos/:id/analyses.
// CritiqueDto and RecreateDto carry the live critique and reverse-engineering fields.

import { z } from 'zod';

export const ANALYSIS_MODES = ['critique', 'editing', 'recreate'] as const;

export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

export const AnalyseInput = z.object({ mode: z.enum(ANALYSIS_MODES) }).strict();

export type AnalyseInput = z.infer<typeof AnalyseInput>;

const score = z.number().int().min(0).max(100);

export const CritiqueDto = z.object({
  technicalScore: score,
  compositionScore: score,
  creativeScore: score,
  overallScore: score,
  technicalFeedback: z.string(),
  compositionFeedback: z.string(),
  creativeFeedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  suggestedSettings: z.string().nullable(),
});

export type CritiqueDto = z.infer<typeof CritiqueDto>;

export const EditingDto = z.object({
  summary: z.string(),
  steps: z.array(z.object({ tool: z.string(), change: z.string(), why: z.string() })),
  filmSimulation: z.string().nullable(),
});

export type EditingDto = z.infer<typeof EditingDto>;

export const RecreateDto = z.object({
  estimatedSettings: z.object({ iso: z.string(), aperture: z.string(), shutterSpeed: z.string(), focalLength: z.string(), meteringMode: z.string() }),
  lightingAnalysis: z.object({ timeOfDay: z.string(), lightType: z.string(), lightDirection: z.string(), modifiers: z.string() }),
  cameraPosition: z.string(),
  lensType: z.string(),
  postProcessing: z.string(),
  shotRecipe: z.array(z.string()),
  difficultyToRecreate: z.enum(['beginner', 'intermediate', 'advanced']),
  gearNeeded: z.array(z.string()),
});

export type RecreateDto = z.infer<typeof RecreateDto>;

const base = { id: z.string().uuid(), photoId: z.string().uuid(), createdAt: z.string() };

export const AnalysisDto = z.discriminatedUnion('mode', [
  z.object({ ...base, mode: z.literal('critique'), critique: CritiqueDto }),
  z.object({ ...base, mode: z.literal('editing'), editing: EditingDto }),
  z.object({ ...base, mode: z.literal('recreate'), recreate: RecreateDto }),
]);

export type AnalysisDto = z.infer<typeof AnalysisDto>;

export const AnalyseResponse = z.object({ analysis: AnalysisDto });

export type AnalyseResponse = z.infer<typeof AnalyseResponse>;

export const AnalysisListResponse = z.object({ analyses: z.array(AnalysisDto) });

export type AnalysisListResponse = z.infer<typeof AnalysisListResponse>;
