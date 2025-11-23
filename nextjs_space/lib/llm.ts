
// LLM API utilities for Foto AI Agent
import OpenAI from 'openai';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Call OpenAI LLM API
 */
export async function callLLM(
  messages: LLMMessage[],
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    json_mode?: boolean;
  } = {}
): Promise<LLMResponse> {
  const {
    model = 'gpt-4o-mini',
    temperature = 0.7,
    max_tokens = 2000,
    json_mode = false,
  } = options;

  try {
    const requestParams: any = {
      model,
      messages,
      temperature,
      max_tokens,
    };

    if (json_mode) {
      requestParams.response_format = { type: 'json_object' };
    }

    const completion = await openai.chat.completions.create(requestParams);
    
    return {
      content: completion.choices[0].message.content || '',
      model: completion.model,
      usage: completion.usage ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens,
      } : undefined,
    };
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    throw error;
  }
}

/**
 * Generate a daily photography challenge
 */
export async function generateChallenge(context: {
  userProfile: {
    name: string;
    skillLevel: string;
    interests: string[];
    gear: string[];
  };
  challengeType: 'WEEKEND_DEEP_DIVE' | 'LUNCH_MICRO' | 'AFTER_WORK' | 'WORK_FROM_HOME';
  location?: string;
  weather?: {
    condition: string;
    temperature: number;
    time: string;
  };
  recentChallenges?: string[];
}): Promise<{
  challengeText: string;
  difficulty: string;
  category: string;
  duration: string;
  tips: string;
  recommendedGear: string[];
}> {
  const { userProfile, challengeType, location, weather, recentChallenges } = context;

  const complexityMap = {
    WEEKEND_DEEP_DIVE: 'high - A substantial creative project',
    LUNCH_MICRO: 'micro - Quick 15-20 minute exercise',
    AFTER_WORK: 'short - 30-45 minute session',
    WORK_FROM_HOME: 'medium - Flexible home/neighborhood project',
  };

  const durationMap = {
    WEEKEND_DEEP_DIVE: '2-4 hours',
    LUNCH_MICRO: '15-25 mins',
    AFTER_WORK: '30-60 mins',
    WORK_FROM_HOME: '45-90 mins',
  };

  const systemPrompt = `You are Foto AI, an expert photography coach specializing in personalized challenges for ${userProfile.name}.

User Profile:
- Skill Level: ${userProfile.skillLevel}
- Interests: ${userProfile.interests.join(', ')}
- Available Gear: ${userProfile.gear.join(', ')}

Challenge Context:
- Type: ${challengeType}
- Complexity: ${complexityMap[challengeType]}
- Duration: ${durationMap[challengeType]}
${location ? `- Location: ${location}` : ''}
${weather ? `- Weather: ${weather.condition}, ${weather.temperature}°F at ${weather.time}` : ''}
${recentChallenges && recentChallenges.length > 0 ? `\nRecent challenges to avoid repeating:\n${recentChallenges.join('\n')}` : ''}

Your task is to generate a specific, actionable photography challenge that:
1. Matches the user's skill level and interests
2. Fits the time constraints and complexity level
3. Considers the weather and location context
4. Recommends specific gear from their collection
5. Provides practical tips for execution

Respond in JSON format with the following structure:
{
  "challengeText": "Clear, specific challenge description",
  "difficulty": "micro|short|medium|deep",
  "category": "street|portrait|architecture|abstract|nature|etc",
  "duration": "${durationMap[challengeType]}",
  "tips": "Practical execution tips and creative suggestions",
  "recommendedGear": ["specific gear items from user's collection"]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

  try {
    const response = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a ${challengeType} photography challenge for today.` },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 1000,
        json_mode: true,
      }
    );

    const result = JSON.parse(response.content);
    return result;
  } catch (error) {
    console.error('Challenge generation failed:', error);
    throw new Error('Failed to generate photography challenge');
  }
}

/**
 * Generate personalized feedback for a photo submission
 */
export async function generateFeedback(context: {
  challengeText: string;
  userNotes?: string;
  skillLevel: string;
  photoAnalysis?: string;
}): Promise<string> {
  const { challengeText, userNotes, skillLevel, photoAnalysis } = context;

  const systemPrompt = `You are Foto AI, a supportive and constructive photography mentor.

Skill Level: ${skillLevel}

Provide personalized feedback that:
1. Acknowledges the effort and completion
2. Highlights what worked well
3. Offers 1-2 specific suggestions for improvement
4. Encourages continued growth

Keep the tone warm, encouraging, and specific. Limit to 3-4 sentences.`;

  const userMessage = `Challenge: ${challengeText}
${userNotes ? `\nPhotographer's Notes: ${userNotes}` : ''}
${photoAnalysis ? `\nPhoto Analysis: ${photoAnalysis}` : ''}

Please provide constructive feedback.`;

  try {
    const response = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 300,
      }
    );

    return response.content;
  } catch (error) {
    console.error('Feedback generation failed:', error);
    return 'Thank you for completing this challenge! Keep practicing and exploring your creative vision.';
  }
}

/**
 * Generate a location-based photography itinerary
 */
export async function generateItinerary(context: {
  location: string;
  userProfile: {
    name: string;
    skillLevel: string;
    interests: string[];
    gear: string[];
  };
  weather?: any;
  duration?: string;
}): Promise<{
  title: string;
  description: string;
  spots: Array<{
    name: string;
    location: string;
    bestTime: string;
    photoOpportunities: string[];
    tips: string;
  }>;
  suggestedTimes: string[];
  gearRecommendations: string[];
}> {
  const { location, userProfile, weather, duration = '3-4 hours' } = context;

  const systemPrompt = `You are Foto AI, an expert in location-based photography planning.

User Profile:
- Name: ${userProfile.name}
- Skill Level: ${userProfile.skillLevel}
- Interests: ${userProfile.interests.join(', ')}
- Available Gear: ${userProfile.gear.join(', ')}

Location: ${location}
Duration: ${duration}
${weather ? `Weather: ${JSON.stringify(weather)}` : ''}

Create a detailed photography itinerary with 3-5 specific spots that:
1. Are actually located in or near ${location}
2. Match the user's interests and skill level
3. Consider optimal lighting times
4. Suggest specific photo opportunities at each spot
5. Recommend appropriate gear

Respond in JSON format with the following structure:
{
  "title": "Compelling itinerary title",
  "description": "Brief overview of the photography tour",
  "spots": [
    {
      "name": "Specific location name",
      "location": "Address or landmark",
      "bestTime": "Time of day (e.g., 'Golden hour 6-7 PM')",
      "photoOpportunities": ["specific shots to capture"],
      "tips": "Practical shooting tips for this location"
    }
  ],
  "suggestedTimes": ["Start at 2 PM", "End by sunset"],
  "gearRecommendations": ["specific gear items"]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

  try {
    const response = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a photography itinerary for ${location}.` },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1500,
        json_mode: true,
      }
    );

    const result = JSON.parse(response.content);
    return result;
  } catch (error) {
    console.error('Itinerary generation failed:', error);
    throw new Error('Failed to generate photography itinerary');
  }
}
