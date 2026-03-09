
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
  challengeType: 'WEEKEND_DEEP_DIVE' | 'LUNCH_BREAK' | 'AFTER_WORK' | 'WFH_MICRO' | 'STORY_DRIVEN' | 'TECHNICAL_MASTERY';
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
  // Story-Driven
  shotList?: string[];
  narrativeContext?: string;
  editingDirection?: string;
  // Technical Mastery
  masteryArea?: string;
  technicalLevel?: number;
  successCriteria?: string;
  whatToLookFor?: string;
}> {
  const { userProfile, challengeType, location, weather, recentChallenges } = context;

  const challengeTypeDescriptions: Record<string, { complexity: string; duration: string; focus: string; extra?: string }> = {
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
    STORY_DRIVEN: {
      complexity: 'high - Narrative photo essay with editorial direction',
      duration: '2-6 hours (can span a full day)',
      focus: 'Photojournalism, storytelling, essay construction, documentary approach',
      extra: `This is a STORY-DRIVEN challenge. You MUST include:
- A narrative premise (who/what the story is about)
- A shot list of 6-10 specific shots needed to tell the story
- Narrative context explaining the editorial angle
- Editing direction for post-processing the series
- The story should feel like a real editorial assignment

Output these additional fields in JSON:
  "shotList": ["shot 1 description", "shot 2 description", ...],
  "narrativeContext": "editorial angle and story direction",
  "editingDirection": "post-processing approach for the series"`
    },
    TECHNICAL_MASTERY: {
      complexity: 'progressive - Locked to the photographer\'s current skill level',
      duration: '30 mins - 2 hours depending on level',
      focus: 'Specific technical skill with measurable success criteria',
      extra: `This is a TECHNICAL MASTERY challenge. You MUST:
- Pick ONE specific technical skill area (e.g., exposure control, depth of field, white balance, focus techniques, motion blur, flash, composition rules, etc.)
- Set a mastery level from 1-5 based on the user's skill level:
  - Beginner → levels 1-2
  - Intermediate → levels 2-4
  - Professional → levels 3-5
- Provide clear success criteria the photographer can self-evaluate
- Explain what to look for in the results

Output these additional fields in JSON:
  "masteryArea": "the specific technical skill being practiced",
  "technicalLevel": <number 1-5>,
  "successCriteria": "how to judge if you succeeded",
  "whatToLookFor": "what to examine in your resulting photos"`
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
${typeInfo.extra ? `\n${typeInfo.extra}` : ''}

Respond in JSON format with the following structure:
{
  "challengeText": "Clear, specific challenge description",
  "difficulty": "micro|short|medium|deep",
  "category": "street|portrait|architecture|abstract|nature|etc",
  "duration": "${typeInfo.duration}",
  "tips": "Practical execution tips and creative suggestions",
  "recommendedGear": ["specific gear items from user's collection"]${challengeType === 'STORY_DRIVEN' ? `,
  "shotList": ["shot 1", "shot 2", "..."],
  "narrativeContext": "editorial angle",
  "editingDirection": "post-processing approach"` : ''}${challengeType === 'TECHNICAL_MASTERY' ? `,
  "masteryArea": "specific skill",
  "technicalLevel": 1-5,
  "successCriteria": "how to judge success",
  "whatToLookFor": "what to examine"` : ''}
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
 * Compare an original and edited photo to generate a slider-by-slider editing recipe.
 * Two-image vision call that identifies adjustments, over-editing, and suggests improvements.
 */
export async function generateEditingRecipe(context: {
  originalImageDataUri: string;
  editedImageDataUri: string;
  skillLevel: string;
  gear?: string[];
}): Promise<import('@/lib/types').EditingRecipe> {
  const { originalImageDataUri, editedImageDataUri, skillLevel, gear } = context;

  const toneGuide =
    skillLevel === 'beginner'
      ? 'Use simple, beginner-friendly language. Explain editing concepts as if teaching someone who just opened Lightroom for the first time. Be encouraging.'
      : skillLevel === 'professional'
        ? 'Be precise and technical. Use professional editing terminology. Assume familiarity with advanced color grading and local adjustments.'
        : 'Be clear and specific. Explain slider values and editing concepts briefly where helpful.';

  const systemPrompt = `You are Foto AI, an expert photo editing coach who analyses before/after photo edits to help photographers learn post-processing.

Photographer skill level: ${skillLevel}
${gear?.length ? `Gear: ${gear.join(', ')}` : ''}

Tone: ${toneGuide}

You will receive TWO images:
1. The ORIGINAL (unedited or less-edited version)
2. The EDITED version (the photographer's post-processing result)

Compare both images carefully and identify:

1. ADJUSTMENTS DETECTED — List each editing slider/adjustment you can identify. For each:
   - Name the slider (Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Clarity, Vibrance, Saturation, Temperature, Tint, Dehaze, Sharpening, Noise Reduction, Vignette, etc.)
   - Direction (increased/decreased)
   - Estimated amount (e.g., "+0.5 EV", "+30", "-20")
   - Assessment: "appropriate", "overdone", or "underdone"

2. OVER-EDITING WARNINGS — Any adjustments pushed too far that hurt the image. Be specific about what looks wrong and how to fix it.

3. SUGGESTED IMPROVEMENTS — Additional adjustments the photographer could make. Include the slider, suggested value, and educational explanation of why.

4. EDITING APPROACH — One-line description of the overall editing style/look being attempted.

5. OVERALL ASSESSMENT — 2-3 sentences: what works, what doesn't, and the key improvement to make.

6. DIFFICULTY LEVEL — How complex is this editing approach (beginner-friendly / intermediate / advanced).

Respond in JSON:
{
  "adjustmentsDetected": [
    { "slider": "name", "direction": "increased|decreased", "estimatedAmount": "value", "assessment": "appropriate|overdone|underdone" }
  ],
  "overEditingWarnings": ["warning string"],
  "suggestedImprovements": [
    { "slider": "name", "value": "suggested value", "reason": "educational explanation" }
  ],
  "editingApproach": "one-line description",
  "overallAssessment": "2-3 sentences",
  "difficultyLevel": "beginner-friendly|intermediate|advanced"
}

Respond with raw JSON only.`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here are my original and edited photos. Please analyse my edits and give me an editing recipe.' },
          { type: 'image_url', image_url: { url: originalImageDataUri, detail: 'high' } },
          { type: 'image_url', image_url: { url: editedImageDataUri, detail: 'high' } },
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
 * Generate personalized weekly insights from aggregated user stats.
 * Returns a narrative summary, highlights, skill breakdown, and recommendation.
 */
export async function generateWeeklyInsights(context: {
  userName: string;
  skillLevel: string;
  stats: import('@/lib/types').WeeklyInsightsData;
}): Promise<import('@/lib/types').WeeklyInsightsResult> {
  const { userName, skillLevel, stats } = context;

  const challengeTrend = stats.challengesCompletedLastWeek > 0
    ? Math.round(((stats.challengesCompletedThisWeek - stats.challengesCompletedLastWeek) / stats.challengesCompletedLastWeek) * 100)
    : stats.challengesCompletedThisWeek > 0 ? 100 : 0;

  const scoreDelta = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return 'no data';
    const diff = current - previous;
    return diff > 0 ? `+${diff} points` : diff < 0 ? `${diff} points` : 'no change';
  };

  const systemPrompt = `You are Foto AI, a warm and insightful photography coach writing a personalized weekly progress report for ${userName}.

Skill level: ${skillLevel}

This week's data:
- Challenges completed: ${stats.challengesCompletedThisWeek} (last week: ${stats.challengesCompletedLastWeek}, trend: ${challengeTrend > 0 ? '+' : ''}${challengeTrend}%)
- Submissions: ${stats.submissionsThisWeek}
- Challenge completion rate: ${stats.challengeCompletionRate}%
- Current streak: ${stats.currentStreak} days (personal best: ${stats.longestStreak})
- Top categories this week: ${stats.topCategories.length > 0 ? stats.topCategories.join(', ') : 'none'}
- Average critique score: ${stats.averageCritiqueScore !== null ? stats.averageCritiqueScore + '/100' : 'no critiques this week'}
- Previous week average: ${stats.previousAverageCritiqueScore !== null ? stats.previousAverageCritiqueScore + '/100' : 'no data'}
- Score trends vs last week:
  - Technical: ${scoreDelta(stats.scoreTrend.technical, stats.previousScoreTrend.technical)}
  - Composition: ${scoreDelta(stats.scoreTrend.composition, stats.previousScoreTrend.composition)}
  - Creative: ${scoreDelta(stats.scoreTrend.creative, stats.previousScoreTrend.creative)}

Write a personalized weekly insights report. Be specific to the data — reference actual numbers and trends. Keep the tone encouraging but honest.

Handle edge cases:
- If no activity this week, focus on re-engagement and motivation
- If no critique scores, skip skill breakdown details and focus on challenge activity
- If this is clearly a first week (no previous data), welcome them warmly

Respond in JSON:
{
  "summary": "2-3 sentence overview of the week — highlight the most notable stat or trend",
  "highlights": ["3-4 short bullet points of specific achievements or notable stats"],
  "skillBreakdown": "1-2 sentences about score trends across technical/composition/creative dimensions (or skip if no critique data)",
  "recommendation": "One specific, actionable recommendation for next week based on the data",
  "motivationalNote": "One short encouraging sentence to close"
}

Respond with raw JSON only.`;

  try {
    const response = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate my weekly insights report for the week of ${stats.weekStart} to ${stats.weekEnd}.` },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 800,
        json_mode: true,
      }
    );

    return JSON.parse(response.content);
  } catch (error) {
    console.error('Weekly insights generation failed:', error);
    return {
      summary: `You completed ${stats.challengesCompletedThisWeek} challenges this week. Keep pushing your creative boundaries!`,
      highlights: [`${stats.challengesCompletedThisWeek} challenges completed`, `${stats.currentStreak} day streak`],
      skillBreakdown: stats.averageCritiqueScore !== null ? `Average critique score: ${stats.averageCritiqueScore}/100` : 'Submit photos for critique to track your skill growth.',
      recommendation: 'Try a new challenge type next week to expand your skills.',
      motivationalNote: 'Every photo you take makes you a better photographer. Keep shooting!',
    };
  }
}

/**
 * Quick vision assessment of a single portfolio photo.
 * Returns a score + style tags for the meta-analysis pass.
 */
export async function assessPortfolioPhoto(context: {
  imageDataUri: string;
  index: number;
  skillLevel: string;
}): Promise<import('@/lib/types').PortfolioPhotoAssessment> {
  const { imageDataUri, index, skillLevel } = context;

  const systemPrompt = `You are Foto AI, an expert portfolio curator doing a quick assessment of a single photo.

Photographer skill level: ${skillLevel}

Provide a rapid assessment of this image for portfolio curation purposes.

Respond in JSON:
{
  "index": ${index},
  "score": <number 0-100 — overall portfolio-worthiness>,
  "styleTags": ["3-5 short tags describing style, mood, genre, color palette"],
  "strength": "one sentence — the strongest quality of this image",
  "weakness": "one sentence — the primary weakness or limitation"
}

Respond with raw JSON only.`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Assess this photo for portfolio curation.' },
          { type: 'image_url', image_url: { url: imageDataUri, detail: 'low' } },
        ],
      },
    ],
    { model: 'gpt-4o-mini', temperature: 0.5, max_tokens: 300, json_mode: true },
  );

  return JSON.parse(response.content);
}

/**
 * Meta-analysis pass: takes all per-image assessments and produces the full portfolio analysis.
 * This is a text-only LLM call (no vision) operating on structured assessment data.
 */
export async function analyzePortfolioMeta(context: {
  assessments: import('@/lib/types').PortfolioPhotoAssessment[];
  skillLevel: string;
  photoCount: number;
}): Promise<Omit<import('@/lib/types').PortfolioAnalysis, 'photoAssessments'>> {
  const { assessments, skillLevel, photoCount } = context;

  const systemPrompt = `You are Foto AI, an expert portfolio curator and photography coach.

Photographer skill level: ${skillLevel}
Total photos submitted: ${photoCount}

You have individual assessments for each photo. Now perform a comprehensive portfolio analysis:

1. BEST SELECTION — Pick the strongest 60-70% of photos for a portfolio. For each included photo, explain why. For each excluded photo, explain why.

2. CONSISTENCY AUDIT — Analyze style consistency across all photos:
   - Score from 0-100 (100 = perfectly consistent style)
   - List specific style variations (color temperature shifts, exposure differences, genre mixing)
   - One sentence recommendation to improve consistency

3. GAP ANALYSIS — Identify:
   - Strengths: what genres/styles are well-represented
   - Gaps: what's missing that would strengthen the portfolio
   - Suggestions: specific shot types to add

4. SEQUENCING — Order the selected photos for maximum impact:
   - Hook (strongest opener)
   - Variety (alternating styles/subjects)
   - Strong closer

5. STYLE SUMMARY — One paragraph describing the photographer's emerging style.

6. OVERALL FEEDBACK — 2-3 sentences of actionable portfolio advice.

Respond in JSON:
{
  "bestSelection": [{ "index": <number>, "reason": "why included" }],
  "excludedPhotos": [{ "index": <number>, "reason": "why excluded" }],
  "consistencyAudit": {
    "consistencyScore": <number 0-100>,
    "variations": ["specific variation 1", "..."],
    "recommendation": "one sentence"
  },
  "gapAnalysis": {
    "strengths": ["strength 1", "..."],
    "gaps": ["gap 1", "..."],
    "suggestions": ["suggestion 1", "..."]
  },
  "sequencing": [{ "index": <number>, "role": "hook|variety|closer|transition" }],
  "styleSummary": "one paragraph",
  "overallFeedback": "2-3 sentences"
}

Respond with raw JSON only.`;

  const assessmentSummary = assessments.map((a) =>
    `Photo ${a.index}: score=${a.score}, tags=[${a.styleTags.join(', ')}], strength="${a.strength}", weakness="${a.weakness}"`
  ).join('\n');

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Here are the individual photo assessments:\n\n${assessmentSummary}\n\nPlease produce the full portfolio analysis.` },
    ],
    { model: 'gpt-4o-mini', temperature: 0.6, max_tokens: 2000, json_mode: true },
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
