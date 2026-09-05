import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createFotoaiGear,
  deleteFotoaiGear,
  FotoaiClientError,
  getFotoaiPreferences,
  getFotoaiProgress,
  getFotoaiSession,
  listFotoaiGear,
  listFotoaiChallenges,
  loginFotoai,
  saveFotoaiPreferences,
  submitFotoaiChallenge,
  updateFotoaiChallengeStatus,
} from '../../lib/fotoai/client.ts';
import { clearFotoaiQueryCache } from '../../lib/fotoai/query-cache.ts';
import { ALICE, BOB } from './helpers/fake-supabase.ts';

type FetchCall = { url: string; init?: RequestInit };

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

test('frontend core: auth uses only FotoAI session routes and sends no browser identity', async () => {
  const calls: FetchCall[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/login')) return jsonResponse({ success: true, userId: ALICE });
    return jsonResponse({ id: ALICE, email: 'alice@test.invalid' });
  };

  await loginFotoai('alice@test.invalid', 'correct-horse', fetcher);
  const user = await getFotoaiSession(fetcher);

  assert.deepEqual(user, {
    id: ALICE,
    email: 'alice@test.invalid',
    name: 'alice',
  });
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/fotoai/auth/login',
    '/api/fotoai/auth/me',
  ]);
  const loginBody = JSON.parse(String(calls[0].init?.body));
  assert.deepEqual(loginBody, { email: 'alice@test.invalid', password: 'correct-horse' });
  assert.equal('userId' in loginBody || 'user_id' in loginBody || 'ownerId' in loginBody, false);
});

test('frontend core: owner challenge and progress reads use session-only FotoAI URLs and map schema rows', async () => {
  const calls: FetchCall[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('/api/fotoai/challenges')) {
      return jsonResponse({
        challenges: [{
          id: 'cccccccc-0000-4000-8000-000000000001',
          user_id: ALICE,
          challenge_type: 'AFTER_WORK',
          challenge_text: 'Shoot shadows',
          difficulty: 'Medium',
          category: 'Light',
          duration: '30 minutes',
          recommended_gear: ['Tripod'],
          tips: 'Expose for highlights',
          issued_date: '2026-09-03T08:00:00Z',
          status: 'pending',
        }],
      });
    }
    return jsonResponse({
      progress: {
        user_id: ALICE,
        total_challenges_completed: 3,
        total_challenges_issued: 4,
        current_streak: 2,
        longest_streak: 5,
        favorite_subjects: ['Street'],
        completionRate: 75,
      },
    });
  };

  const challenges = await listFotoaiChallenges({ status: 'pending', limit: 1 }, fetcher);
  const progress = await getFotoaiProgress(fetcher);

  assert.equal(challenges[0].challengeText, 'Shoot shadows');
  assert.deepEqual(challenges[0].recommendedGear, ['Tripod']);
  assert.equal(challenges[0].issuedDate, '2026-09-03T08:00:00Z');
  assert.deepEqual(progress, {
    totalChallengesCompleted: 3,
    totalChallengesIssued: 4,
    currentStreak: 2,
    longestStreak: 5,
    completionRate: 75,
    favoriteSubjects: ['Street'],
  });
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/fotoai/challenges?status=pending&limit=1',
    '/api/fotoai/progress',
  ]);
  assert.ok(calls.every((call) => !/userId|user_id|ownerId/.test(call.url)));
});

test('frontend core: forged identity fields are not copied into a submission', async () => {
  let sentForm: FormData | undefined;
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), '/api/fotoai/submissions');
    sentForm = init?.body as FormData;
    return jsonResponse({ submission: { id: 'dddddddd-0000-4000-8000-000000000001', feedback: null } }, 201);
  };
  const forgedInput = {
    challengeId: 'cccccccc-0000-4000-8000-000000000001',
    notes: 'done',
    rating: 4,
    userId: BOB,
    user_id: BOB,
    ownerId: BOB,
  } as any;

  await submitFotoaiChallenge(forgedInput, fetcher);

  assert.ok(sentForm);
  assert.equal(sentForm!.get('challengeId'), forgedInput.challengeId);
  assert.equal(sentForm!.get('notes'), 'done');
  assert.equal(sentForm!.get('rating'), '4');
  assert.equal(sentForm!.has('userId'), false);
  assert.equal(sentForm!.has('user_id'), false);
  assert.equal(sentForm!.has('ownerId'), false);
});

test('frontend core: cross-user denial from the FotoAI route stays a 404 error', async () => {
  const fetcher = async () => jsonResponse({ error: 'Challenge not found', code: 'not_found' }, 404);

  await assert.rejects(
    updateFotoaiChallengeStatus('cccccccc-0000-4000-8000-000000000002', 'skipped', fetcher),
    (error: unknown) => {
      assert.ok(error instanceof FotoaiClientError);
      assert.equal(error.status, 404);
      assert.equal(error.code, 'not_found');
      return true;
    },
  );
});

test('frontend profile: typed preference and gear calls use exact session-only routes and DTOs', async () => {
  const calls: FetchCall[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === '/api/fotoai/preferences' && init?.method === 'PUT') {
      return jsonResponse({ preferences: JSON.parse(String(init.body)) });
    }
    if (url === '/api/fotoai/preferences') {
      return jsonResponse({ preferences: { skillLevel: 'advanced', photographyInterests: ['street'], homeLocation: null, currentLocation: 'CBD' } });
    }
    if (url === '/api/fotoai/gear' && init?.method === 'POST') {
      return jsonResponse({ gear: { id: 'aaaaaaaa-0000-4000-8000-000000000001', ...JSON.parse(String(init.body)) } }, 201);
    }
    if (url === '/api/fotoai/gear') return jsonResponse({ gear: [] });
    return jsonResponse({ success: true });
  };

  const preferences = await getFotoaiPreferences(fetcher);
  const saved = await saveFotoaiPreferences({
    skillLevel: 'professional',
    photographyInterests: ['night'],
    homeLocation: null,
    currentLocation: 'Sydney',
  }, fetcher);
  const listed = await listFotoaiGear(fetcher);
  const created = await createFotoaiGear({ category: 'lens', brand: 'Sigma', model: '18-50' }, fetcher);
  await deleteFotoaiGear(created.id, fetcher);

  assert.equal(preferences.skillLevel, 'advanced');
  assert.equal(saved.currentLocation, 'Sydney');
  assert.deepEqual(listed, []);
  assert.equal(created.brand, 'Sigma');
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/fotoai/preferences',
    '/api/fotoai/preferences',
    '/api/fotoai/gear',
    '/api/fotoai/gear',
    '/api/fotoai/gear/aaaaaaaa-0000-4000-8000-000000000001',
  ]);
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
    skillLevel: 'professional', photographyInterests: ['night'], homeLocation: null, currentLocation: 'Sydney',
  });
  assert.deepEqual(JSON.parse(String(calls[3].init?.body)), { category: 'lens', brand: 'Sigma', model: '18-50' });
  assert.ok(calls.every((call) => !/userId|user_id|userid|ownerId|owner_id/.test(`${call.url}${String(call.init?.body ?? '')}`)));
});

test('frontend profile: each failed preference or gear request rejects before success', async () => {
  const failed = async () => jsonResponse({ error: 'safe failure', code: 'upstream' }, 502);
  const operations = [
    getFotoaiPreferences(failed),
    saveFotoaiPreferences({ skillLevel: 'advanced' }, failed),
    listFotoaiGear(failed),
    createFotoaiGear({ category: 'camera', brand: 'Sony', model: 'A7' }, failed),
    deleteFotoaiGear('aaaaaaaa-0000-4000-8000-000000000001', failed),
  ];
  for (const operation of operations) {
    await assert.rejects(operation, FotoaiClientError);
  }
});

test('frontend profile: malformed optional DTO values map to safe defaults', async () => {
  const preferenceFetcher = async () => jsonResponse({
    preferences: { skillLevel: 'invalid', photographyInterests: null, homeLocation: 4, currentLocation: undefined },
  });
  assert.deepEqual(await getFotoaiPreferences(preferenceFetcher), {
    skillLevel: 'intermediate', photographyInterests: [], homeLocation: null, currentLocation: null,
  });

  const gearFetcher = async () => jsonResponse({ gear: [{ id: 1, category: 'invalid', brand: null, model: undefined }] });
  assert.deepEqual(await listFotoaiGear(gearFetcher), [{ id: '1', category: 'other', brand: '', model: '' }]);
});

test('frontend profile: onboarding and settings use typed FotoAI calls with no browser owner', () => {
  const onboarding = readFileSync(new URL('../../app/onboarding/page.tsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../../app/settings/page.tsx', import.meta.url), 'utf8');
  for (const source of [onboarding, settings]) {
    assert.doesNotMatch(source, /\/api\/settings\//);
    assert.doesNotMatch(source, /useAppwriteAuth|userId|user_id|userid|ownerId|owner_id/);
    assert.match(source, /saveFotoaiPreferences/);
    assert.match(source, /createFotoaiGear/);
  }
  assert.match(onboarding, /await\s+saveFotoaiPreferences/);
  assert.match(onboarding, /Promise\.allSettled/);
  assert.match(onboarding, /throw\s+new\s+Error/);
  assert.match(settings, /getFotoaiPreferences/);
  assert.match(settings, /listFotoaiGear/);
  assert.match(settings, /deleteFotoaiGear/);
});

test('frontend onboarding: useAuth declares user and status before the welcome greeting reads user', () => {
  const onboarding = readFileSync(new URL('../../app/onboarding/page.tsx', import.meta.url), 'utf8');
  const declaration = onboarding.search(/const\s*{\s*user\s*,\s*status\s*}\s*=\s*useAuth\(\)/);
  const greeting = onboarding.indexOf("user?.name?.split(' ')[0]");
  assert.notEqual(declaration, -1, 'onboarding must destructure user and status from useAuth');
  assert.notEqual(greeting, -1, 'the welcome greeting must keep its safe user name read');
  assert.ok(declaration < greeting, 'user must be declared before the welcome greeting reads it');
});

test('frontend onboarding: every SKILL_LEVELS value is explicitly typed as FotoaiSkillLevel', () => {
  const onboarding = readFileSync(new URL('../../app/onboarding/page.tsx', import.meta.url), 'utf8');
  assert.match(
    onboarding,
    /const\s+SKILL_LEVELS\s*:\s*Array<\s*{\s*value:\s*FotoaiSkillLevel;\s*label:\s*string;\s*desc:\s*string\s*}>\s*=/,
  );
  assert.match(onboarding, /useState<FotoaiSkillLevel>\('intermediate'\)/);
});

test('frontend core: pages use the FotoAI client and do not reuse an unscoped challenge cache', () => {
  const dashboard = readFileSync(new URL('../../app/dashboard/page.tsx', import.meta.url), 'utf8');
  const hooks = readFileSync(new URL('../../hooks/use-dashboard-data.ts', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../../contexts/auth-context.tsx', import.meta.url), 'utf8');
  const middleware = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8');

  assert.match(dashboard, /submitFotoaiChallenge/);
  assert.match(dashboard, /updateFotoaiChallengeStatus/);
  assert.doesNotMatch(dashboard, /fetch\(['"`]\/api\/submissions/);
  assert.doesNotMatch(dashboard, /fetch\(['"`]\/api\/challenges['"`]/);
  assert.doesNotMatch(dashboard, /localStorage/);
  assert.match(hooks, /listFotoaiChallenges/);
  assert.match(hooks, /getFotoaiProgress/);
  assert.doesNotMatch(hooks, /\/api\/progress\?userId|\/api\/challenges\?userId/);
  assert.doesNotMatch(auth, /['"`]\/api\/auth\//);
  assert.match(middleware, /FOTOAI_SESSION_COOKIE/);
});

test('frontend core: session change clears all FotoAI query data but keeps excluded caches', () => {
  const cachedKeys = new Set([
    JSON.stringify(['fotoai', 'challenges', 'pending']),
    JSON.stringify(['fotoai', 'progress']),
    JSON.stringify(['itineraries', ALICE]),
  ]);
  const cache = {
    removeQueries({ queryKey }: { queryKey: readonly string[] }) {
      for (const key of cachedKeys) {
        const parsed = JSON.parse(key) as string[];
        if (queryKey.every((part, index) => parsed[index] === part)) cachedKeys.delete(key);
      }
    },
  };

  clearFotoaiQueryCache(cache);

  assert.deepEqual([...cachedKeys], [JSON.stringify(['itineraries', ALICE])]);

  const auth = readFileSync(new URL('../../contexts/auth-context.tsx', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(auth, /clearFotoaiQueryCache\(queryClient\)/);
  assert.match(auth, /finally\s*{\s*clearFotoaiQueryCache\(queryClient\)/);
  assert.ok(layout.indexOf('<QueryProvider>') < layout.indexOf('<AuthProvider>'));
});
