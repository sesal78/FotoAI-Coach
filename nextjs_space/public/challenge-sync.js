/**
 * Challenge Sync Script - Foto AI
 * Listens for challenge data via postMessage from chatbot iframe
 * and syncs to dashboard database
 * Version: 20241231001
 */

(function() {
  'use strict';
  
  console.log('[Foto Sync] Script loaded v20241231001');
  
  // Listen for postMessage from chatbot iframe
  window.addEventListener('message', async function(event) {
    // Accept messages from Abacus.AI
    if (!event.origin.includes('abacus.ai')) {
      return;
    }
    
    const data = event.data;
    
    // Check for challenge sync data
    if (data && data.type === 'CHALLENGE_SYNC' && data.challenge) {
      console.log('[Foto Sync] Received challenge via postMessage:', data.challenge);
      await syncChallenge(data.challenge);
    }
  });
  
  // Also poll the page for visible challenge markers
  let lastSyncedText = '';
  
  function checkForChallengeMarkers() {
    const pageText = document.body.innerText || '';
    
    // Look for challenge markers in visible text
    const markers = [
      /📸.*challenge/i,
      /location\s*:/i,
      /duration\s*:/i,
      /difficulty\s*:/i,
      /gear\s*:/i,
      /tips?\s*:/i
    ];
    
    const matchCount = markers.filter(m => m.test(pageText)).length;
    
    // If we have 3+ markers and text changed, try to sync
    if (matchCount >= 3 && pageText !== lastSyncedText) {
      const challengeData = extractChallengeFromText(pageText);
      if (challengeData) {
        console.log('[Foto Sync] Detected challenge markers, syncing...');
        lastSyncedText = pageText;
        syncChallenge(challengeData);
      }
    }
  }
  
  function extractChallengeFromText(text) {
    // Try to extract structured data
    const locationMatch = text.match(/location\s*:\s*([^\n]+)/i);
    const durationMatch = text.match(/duration\s*:\s*([^\n]+)/i);
    const difficultyMatch = text.match(/difficulty\s*:\s*([^\n]+)/i);
    const gearMatch = text.match(/(?:gear|equipment|camera)\s*:\s*([^\n]+)/i);
    const tipsMatch = text.match(/tips?\s*:\s*([^\n]+)/i);
    
    // Find the main challenge description (usually after 📸)
    const challengeMatch = text.match(/📸[^\n]*\n([^\n]{50,})/i);
    
    if (!challengeMatch && !locationMatch && !durationMatch) {
      return null;
    }
    
    return {
      challengeText: challengeMatch ? challengeMatch[1].trim() : 'Photography Challenge',
      location: locationMatch ? locationMatch[1].trim() : 'Melbourne',
      duration: durationMatch ? durationMatch[1].trim() : '1-2 hours',
      difficulty: difficultyMatch ? difficultyMatch[1].trim() : 'INTERMEDIATE',
      recommendedGear: gearMatch ? gearMatch[1].trim() : '',
      tips: tipsMatch ? tipsMatch[1].trim() : '',
      category: 'STREET'
    };
  }
  
  async function syncChallenge(challenge) {
    try {
      const payload = {
        userId: '1',
        challengeText: challenge.challengeText || challenge.challenge_text || 'Photography Challenge',
        category: challenge.category || 'STREET',
        difficulty: challenge.difficulty || 'INTERMEDIATE',
        duration: challenge.duration || '1-2 hours',
        location: challenge.location || 'Melbourne',
        recommendedGear: challenge.recommendedGear || challenge.recommended_gear || '',
        tips: challenge.tips || '',
        weatherConditions: challenge.weatherConditions || challenge.weather_conditions || 'Any'
      };
      
      console.log('[Foto Sync] Syncing to dashboard:', payload);
      
      const response = await fetch('/api/challenges/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[Foto Sync] ✅ Challenge synced successfully:', result);
      } else {
        console.error('[Foto Sync] ❌ Sync failed:', response.status);
      }
    } catch (err) {
      console.error('[Foto Sync] ❌ Error syncing:', err);
    }
  }
  
  // Check for markers periodically
  setInterval(checkForChallengeMarkers, 5000);
  
  // Also check immediately
  setTimeout(checkForChallengeMarkers, 2000);
  
  console.log('[Foto Sync] Listening for challenges...');
})();
