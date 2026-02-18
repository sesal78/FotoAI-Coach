/**
 * Challenge Sync Script - Foto AI
 * Handles challenges sent via postMessage from the Abacus.AI chatbot iframe.
 * Version: 20250218001
 */

(function () {
  'use strict';

  console.log('[Foto Sync] Script loaded v20250218001');

  // Resolve the real user ID: prefer injected global, fall back to /api/auth/me
  async function resolveUserId() {
    if (window.FOTO_USER_ID) return window.FOTO_USER_ID;
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const me = await res.json();
        if (me.id) {
          window.FOTO_USER_ID = me.id;
          return me.id;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  // Parse a challenge object from various formats the chatbot might send
  function parseChallenge(data) {
    // Format 1: already an object with challengeText
    if (data && typeof data === 'object' && data.challengeText) {
      return data;
    }
    // Format 2: postMessage event with type + challenge
    if (data && typeof data === 'object' && data.challenge) {
      return data.challenge;
    }
    // Format 3: string containing CHALLENGE_SYNC_DATA block
    if (typeof data === 'string') {
      const jsonBlockMatch = data.match(/CHALLENGE_SYNC_DATA\s*\n?\s*(\{[\s\S]*?\})/i);
      if (jsonBlockMatch) {
        try { return JSON.parse(jsonBlockMatch[1]); } catch { /* fall through */ }
      }
      // Format 4: raw JSON string
      if (data.trim().startsWith('{')) {
        try { return JSON.parse(data.trim()); } catch { /* fall through */ }
      }
    }
    return null;
  }

  async function syncChallenge(rawData) {
    const challenge = parseChallenge(rawData);
    if (!challenge) {
      console.warn('[Foto Sync] Could not parse challenge data:', rawData);
      return;
    }

    const userId = await resolveUserId();
    if (!userId) {
      console.warn('[Foto Sync] No authenticated user — skipping sync');
      return;
    }

    const gearArray = Array.isArray(challenge.recommendedGear)
      ? challenge.recommendedGear
      : challenge.recommendedGear
      ? [challenge.recommendedGear]
      : Array.isArray(challenge.recommended_gear)
      ? challenge.recommended_gear
      : challenge.recommended_gear
      ? [challenge.recommended_gear]
      : [];

    const payload = {
      userId,
      challengeText: challenge.challengeText || challenge.challenge_text || 'Photography Challenge',
      category: challenge.category || 'GENERAL',
      difficulty: challenge.difficulty || 'INTERMEDIATE',
      duration: challenge.duration || '1-2 hours',
      location: challenge.location || null,
      recommendedGear: gearArray,
      tips: challenge.tips || null,
      weatherConditions: challenge.weatherConditions || challenge.weather_conditions || null,
    };

    console.log('[Foto Sync] Syncing challenge for user', userId, payload);

    try {
      const res = await fetch('/api/challenges/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const result = await res.json();
        console.log('[Foto Sync] ✅ Synced:', result);
      } else {
        console.error('[Foto Sync] ❌ Sync failed:', res.status);
      }
    } catch (err) {
      console.error('[Foto Sync] ❌ Error:', err);
    }
  }

  // Listen for postMessage events from the Abacus.AI iframe
  window.addEventListener('message', async function (event) {
    if (!event.origin.includes('abacus.ai')) return;

    const data = event.data;
    if (!data) return;

    console.log('[Foto Sync] Received postMessage from abacus.ai:', typeof data, data);

    // Handle typed CHALLENGE_SYNC or CHALLENGE_SYNC_DATA event
    if (
      typeof data === 'object' &&
      (data.type === 'CHALLENGE_SYNC' || data.type === 'CHALLENGE_SYNC_DATA')
    ) {
      await syncChallenge(data.challenge || data);
      return;
    }

    // Handle string message containing CHALLENGE_SYNC_DATA
    if (typeof data === 'string' && data.includes('CHALLENGE_SYNC_DATA')) {
      await syncChallenge(data);
      return;
    }

    // Handle JSON string message
    if (typeof data === 'string' && data.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.challengeText || parsed.challenge_text) {
          await syncChallenge(parsed);
        }
      } catch { /* not JSON */ }
    }
  });

  console.log('[Foto Sync] Listening for challenge postMessage events...');
})();
