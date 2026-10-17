// Outside services used by FotoAI handlers: LLM, weather and email.
//
// Handlers receive these through deps so tests never call the network.
// server.ts wires the real modules; tests pass fakes.

import type * as Email from '../email.ts';
import type * as Llm from '../llm.ts';
import type * as Weather from '../weather.ts';

export interface FotoaiServices {
  ai: Pick<
    typeof Llm,
    | 'callLLM'
    | 'generateChallenge'
    | 'generateFeedback'
    | 'critiquePhoto'
    | 'reverseEngineerPhoto'
    | 'generateEditingRecipe'
    | 'generateWeeklyInsights'
    | 'assessPortfolioPhoto'
    | 'analyzePortfolioMeta'
    | 'generateItinerary'
  >;
  weather: Pick<typeof Weather, 'getWeather' | 'analyzeWeatherForPhotography'>;
  mail: Pick<typeof Email, 'sendChallengeEmail' | 'sendWeeklyReport' | 'sendWeatherAlert'>;
}
