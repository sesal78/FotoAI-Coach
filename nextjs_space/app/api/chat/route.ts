import { NextRequest, NextResponse } from 'next/server';
import { Query, ID } from 'node-appwrite';
import { createSessionClient, createAdminClient } from '@/lib/appwrite-server';
import {
  DATABASE_ID,
  COLLECTION_DAILY_CHALLENGES,
  COLLECTION_USER_PROGRESS,
} from '@/lib/appwrite-collections';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are Foto, an expert AI photography coach. You help photographers of all skill levels with:
- Personalised daily photography challenges
- Photo tour itineraries for any location
- Gear advice, technique tips, composition guidance
- Creative prompts and project ideas
- Post-processing and editing advice

Be warm, encouraging, and specific. Tailor your advice to the photographer's gear and skill level if they share it.

IMPORTANT — When you generate a photography challenge for the user, you MUST include a machine-readable block at the very end of your response, in this exact format (no extra text around it):

<CHALLENGE_DATA>
{"challengeText":"<full challenge description>","category":"<STREET|LANDSCAPE|PORTRAIT|ARCHITECTURE|NATURE|ABSTRACT|DOCUMENTARY>","difficulty":"<BEGINNER|INTERMEDIATE|ADVANCED>","duration":"<e.g. 30-45 minutes>","location":"<suggested location or null>","tips":"<1-2 practical tips>","recommendedGear":["<item1>","<item2>"]}
</CHALLENGE_DATA>

Do not include the CHALLENGE_DATA block unless you are actually generating a challenge. For general conversation, tips, itineraries, or other requests, omit it entirely.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages }: { messages: ChatMessage[] } = body;

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    // Get current user from session (best-effort — chat works even if unauthenticated)
    let userId: string | null = null;
    try {
      const { account } = await createSessionClient(request);
      const user = await account.get();
      userId = user.$id;
      console.log('[chat] Authenticated userId:', userId);
    } catch (e) {
      console.warn('[chat] No session — challenges will not be saved:', e);
    }

    // Call OpenAI
    const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        temperature: 0.75,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      console.error('[chat] LLM error:', llmRes.status, err);
      const friendly =
        llmRes.status === 401 ? 'OpenAI API key is missing or invalid. Please check your OPENAI_API_KEY environment variable.' :
        llmRes.status === 404 ? 'OpenAI model not found. Check the model name in the API route.' :
        llmRes.status === 429 ? 'OpenAI rate limit reached. Please wait a moment and try again.' :
        `AI service error (${llmRes.status}). Check server logs for details.`;
      return NextResponse.json({ error: friendly }, { status: 502 });
    }

    const llmData = await llmRes.json();
    const rawContent: string = llmData.choices?.[0]?.message?.content ?? '';

    // Detect and extract CHALLENGE_DATA block
    const challengeMatch = rawContent.match(/<CHALLENGE_DATA>\s*([\s\S]*?)\s*<\/CHALLENGE_DATA>/i);
    let savedChallenge = null;

    console.log('[chat] CHALLENGE_DATA found:', !!challengeMatch, '| userId:', userId);

    if (challengeMatch && userId) {
      try {
        // Strip markdown code fences OpenAI sometimes adds (```json ... ```)
        const rawJson = challengeMatch[1].replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const challengeData = JSON.parse(rawJson);
        console.log('[chat] Parsed challenge:', challengeData.category, challengeData.difficulty);
        const { databases } = createAdminClient();

        // Upsert: update existing pending challenge or create new one
        const existing = await databases.listDocuments(DATABASE_ID, COLLECTION_DAILY_CHALLENGES, [
          Query.equal('userId', userId),
          Query.equal('status', 'pending'),
          Query.limit(1),
        ]);

        const gearArray = Array.isArray(challengeData.recommendedGear)
          ? challengeData.recommendedGear
          : challengeData.recommendedGear
          ? [challengeData.recommendedGear]
          : [];

        if (existing.documents.length > 0) {
          const doc = await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_DAILY_CHALLENGES,
            existing.documents[0].$id,
            {
              challengeText: challengeData.challengeText,
              category: challengeData.category || 'GENERAL',
              difficulty: challengeData.difficulty || 'INTERMEDIATE',
              duration: challengeData.duration || '1-2 hours',
              location: challengeData.location ?? null,
              tips: challengeData.tips ?? null,
              recommendedGear: gearArray,
              challengeType: 'CHATBOT_GENERATED',
              issuedDate: new Date().toISOString(),
            }
          );
          savedChallenge = { ...doc, id: doc.$id };
        } else {
          const doc = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_DAILY_CHALLENGES,
            ID.unique(),
            {
              userId,
              challengeText: challengeData.challengeText,
              category: challengeData.category || 'GENERAL',
              difficulty: challengeData.difficulty || 'INTERMEDIATE',
              duration: challengeData.duration || '1-2 hours',
              location: challengeData.location ?? null,
              tips: challengeData.tips ?? null,
              recommendedGear: gearArray,
              weatherConditions: null,
              challengeType: 'CHATBOT_GENERATED',
              issuedDate: new Date().toISOString(),
              status: 'pending',
            }
          );
          savedChallenge = { ...doc, id: doc.$id };

          // Increment totalChallengesIssued in user progress
          try {
            const prog = await databases.listDocuments(DATABASE_ID, COLLECTION_USER_PROGRESS, [
              Query.equal('userId', userId),
              Query.limit(1),
            ]);
            if (prog.documents.length > 0) {
              await databases.updateDocument(DATABASE_ID, COLLECTION_USER_PROGRESS, prog.documents[0].$id, {
                totalChallengesIssued: (prog.documents[0].totalChallengesIssued || 0) + 1,
              });
            }
          } catch { /* non-fatal */ }
        }
      } catch (parseErr) {
        console.error('[chat] Failed to parse/save challenge:', parseErr);
        console.error('[chat] Raw CHALLENGE_DATA content:', challengeMatch[1]);
      }
    } else if (challengeMatch && !userId) {
      console.warn('[chat] CHALLENGE_DATA found but no userId — not saving');
    }

    // Strip the machine-readable block from the visible message
    const visibleContent = rawContent
      .replace(/<CHALLENGE_DATA>\s*[\s\S]*?\s*<\/CHALLENGE_DATA>/gi, '')
      .trim();

    return NextResponse.json({
      message: visibleContent,
      challenge: savedChallenge,
    });
  } catch (error) {
    console.error('[chat] Error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
