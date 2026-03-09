
// LLM API utilities for Foto AI Agent

export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMContentPart[];
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

/**
 * Call OpenAI-compatible LLM API (supports text and vision)
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
    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens,
    };

    if (json_mode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
    };
  } catch (error) {
    console.error('LLM API call failed:', error);
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
  challengeType: 'WEEKEND_DEEP_DIVE' | 'LUNCH_BREAK' | 'AFTER_WORK' | 'WFH_MICRO';
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

  const challengeTypeDescriptions: Record<string, { complexity: string; duration: string; focus: string }> = {
    WEEKEND_DEEP_DIVE: {
      complexity: 'high - A substantial, immersive creative project',
      duration: '2-4 hours',
      focus: 'Comprehensive exploration, multiple locations, detailed photo essays'
    },
    LUNCH_BREAK: {
      complexity: 'micro - Quick creative burst during lunch break',
      duration: '30-45 mins',
      focus: 'One focused subject, nearby location, single concept execution'
    },
    AFTER_WORK: {
      complexity: 'medium - Golden hour focused session',
      duration: '1-2 hours',
      focus: 'Evening light, urban exploration, accessible locations'
    },
    WFH_MICRO: {
      complexity: 'micro - Creative break from home office',
      duration: '15-20 mins',
      focus: 'Indoor/balcony shots, still life, window light, immediate surroundings'
    },
  };

  const typeInfo = challengeTypeDescriptions[challengeType] || challengeTypeDescriptions.WEEKEND_DEEP_DIVE;

  const systemPrompt = `You are Foto AI, an expert photography coach specializing in personalized challenges for ${userProfile.name}.

User Profile:
- Skill Level: ${userProfile.skillLevel}
- Interests: ${userProfile.interests.join(', ')}
- Available Gear: ${userProfile.gear.join(', ')}

Challenge Context:
- Type: ${challengeType}
- Complexity: ${typeInfo.complexity}
- Duration: ${typeInfo.duration}
- Focus: ${typeInfo.focus}
${location ? `- Location: ${location}` : ''}
${weather ? `- Weather: ${weather.condition}, ${weather.temperature}°F at ${weather.time}` : ''}
${recentChallenges && recentChallenges.length > 0 ? `\nRecent challenges to avoid repeating:\n${recentChallenges.join('\n')}` : ''}

IMPORTANT: Generate a UNIQUE challenge every time. Be creative and vary:
- The specific locations within the city
- The photography techniques and approaches
- The subjects and themes
- The creative angles and perspectives

Your task is to generate a specific, actionable photography challenge that:
1. Matches the user's skill level and interests
2. Fits the time constraints and complexity level for ${challengeType}
3. Considers the weather and location context
4. Recommends specific gear from their collection
5. Provides practical tips for execution
6. Is DIFFERENT from any recent challenges

Respond in JSON format with the following structure:
{
  "challengeText": "Clear, specific challenge description",
  "difficulty": "micro|short|medium|deep",
  "category": "street|portrait|architecture|abstract|nature|etc",
  "duration": "${typeInfo.duration}",
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
 * Photo critique result type
 */
export interface PhotoCritiqueResult {
  technicalScore: number;
  compositionScore: number;
  creativeScore: number;
  overallScore: number;
  technicalFeedback: string;
  compositionFeedback: string;
  creativeFeedback: string;
  strengths: string[];
  improvements: string[];
  suggestedSettings: string;
}

/**
 * Analyse a photo across technical, composition, and creative dimensions.
 * Accepts a base64 data URI or a public image URL.
 */
export async function critiquePhoto(context: {
  imageDataUri: string;
  skillLevel: string;
  challengeText?: string;
  userNotes?: string;
  gear?: string[];
}): Promise<PhotoCritiqueResult> {
  const { imageDataUri, skillLevel, challengeText, userNotes, gear } = context;

  const toneGuide =
    skillLevel === 'beginner'
      ? 'Use an encouraging, "explain like I\'m five" tone. Celebrate small wins and avoid jargon.'
      : skillLevel === 'professional'
        ? 'Be direct and technical. Assume strong fundamentals. Focus on subtle refinements.'
        : 'Be constructive and specific. Explain technical concepts briefly where needed.';

  const systemPrompt = `You are Foto AI, an expert photography coach providing detailed photo critiques.

Photographer skill level: ${skillLevel}
${gear?.length ? `Gear: ${gear.join(', ')}` : ''}
${challengeText ? `Challenge being attempted: ${challengeText}` : ''}
${userNotes ? `Photographer's notes: ${userNotes}` : ''}

Tone: ${toneGuide}

Analyse the uploaded photograph across three dimensions:

1. TECHNICAL (exposure, focus/sharpness, noise, white balance, dynamic range)
2. COMPOSITION (rule of thirds, leading lines, balance, depth/layering, negative space, frame edges)
3. CREATIVE (storytelling, emotional impact, colour theory, genre execution)

For each dimension:
- Provide 3-5 sentences of specific, actionable feedback
- Score from 0-100

Also provide:
- An overall score (weighted average: technical 35%, composition 35%, creative 30%)
- Top 3 strengths (short phrases)
- Top 3 priority improvements (short phrases, most impactful first)
- A brief "suggested settings" note if you can infer better camera settings

Respond in JSON:
{
  "technicalScore": <number>,
  "compositionScore": <number>,
  "creativeScore": <number>,
  "overallScore": <number>,
  "technicalFeedback": "<string>",
  "compositionFeedback": "<string>",
  "creativeFeedback": "<string>",
  "strengths": ["<string>", "<string>", "<string>"],
  "improvements": ["<string>", "<string>", "<string>"],
  "suggestedSettings": "<string>"
}

Respond with raw JSON only.`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Please critique this photograph.' },
          { type: 'image_url', image_url: { url: imageDataUri, detail: 'high' } },
        ],
      },
    ],
    {
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 1500,
      json_mode: true,
    },
  );

  return JSON.parse(response.content);
}

/**
 * Reverse-engineer how an inspiration photo was taken.
 * Returns estimated camera settings, lighting, position, and a shot recipe.
 */
export async function reverseEngineerPhoto(context: {
  imageDataUri: string;
  skillLevel: string;
  gear?: string[];
}): Promise<import('@/lib/types').ReverseEngineeringResult> {
  const { imageDataUri, skillLevel, gear } = context;

  const toneGuide =
    skillLevel === 'beginner'
      ? 'Use simple, beginner-friendly language. Avoid jargon or explain it when used. Be encouraging.'
      : skillLevel === 'professional'
        ? 'Be precise and technical. Assume familiarity with advanced concepts.'
        : 'Be clear and specific. Briefly explain technical terms where helpful.';

  const systemPrompt = `You are Foto AI, an expert photography coach who reverse-engineers photos to help photographers recreate shots they admire.

Photographer skill level: ${skillLevel}
${gear?.length ? `Available gear: ${gear.join(', ')}` : ''}

Tone: ${toneGuide}

Analyse the uploaded photograph and determine how it was taken. Provide:

1. ESTIMATED CAMERA SETTINGS — ISO, aperture, shutter speed, focal length, metering mode
2. LIGHTING ANALYSIS — time of day, light type (natural/artificial/mixed), direction, any modifiers
3. CAMERA POSITION — distance from subject, angle, height relative to subject
4. LENS TYPE — what kind of lens was likely used and why
5. POST-PROCESSING — editing approach to achieve this look (color grade, contrast, toning)
6. SHOT RECIPE — step-by-step instructions (5-8 steps) to recreate this shot
7. DIFFICULTY — how hard this is to recreate (beginner / intermediate / advanced)
8. GEAR NEEDED — essential equipment to recreate this${gear?.length ? ' (prefer items from the photographer\'s gear list when possible)' : ''}

Respond in JSON:
{
  "estimatedSettings": {
    "iso": "<range or value>",
    "aperture": "<value>",
    "shutterSpeed": "<value>",
    "focalLength": "<value>",
    "meteringMode": "<mode>"
  },
  "lightingAnalysis": {
    "timeOfDay": "<description>",
    "lightType": "<natural/artificial/mixed — details>",
    "lightDirection": "<direction relative to camera>",
    "modifiers": "<any light modifiers or none>"
  },
  "cameraPosition": "<description of camera position, distance, angle>",
  "lensType": "<lens type and reasoning>",
  "postProcessing": "<editing approach description>",
  "shotRecipe": ["step 1", "step 2", "..."],
  "difficultyToRecreate": "<beginner|intermediate|advanced>",
  "gearNeeded": ["item 1", "item 2", "..."]
}

Respond with raw JSON only.`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Reverse-engineer this photograph. How was this shot taken and how can I recreate it?' },
          { type: 'image_url', image_url: { url: imageDataUri, detail: 'high' } },
        ],
      },
    ],
    {
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 1500,
      json_mode: true,
    },
  );

  return JSON.parse(response.content);
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
