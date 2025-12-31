
/**
 * Challenge Share Buttons - Foto AI
 * Detects challenges in chat and provides one-click email/Slack delivery
 * Version: 2024123009 (Visible Text Detection)
 * Target Email: seun_salami@outlook.com
 * Target Slack: #fotoai (C0A604Q05L3)
 * Updates: 
 * - FIX: Flexible structure-based detection (requires 2+ challenge markers)
 * - MATCHES: "Recommended Gear:", "Shooting Tips:", "Weather:", "Location:", "Duration:"
 * - FILTERS: Excludes welcome text, UI prompts, example quotes
 * - Lower threshold for better detection of real challenges
 * - Prevents false positives from intro/welcome screens
 * - NEW: Added Slack integration button
 * - BEST: Structured CHALLENGE_SYNC_DATA format (when chatbot provides it)
 */

(function() {
  'use strict';

  console.log('[Foto Share] Script loaded - Version: 2024123009 (Visible Text Detection)');
  console.log('[Foto Share] Target email: seun_salami@outlook.com');
  console.log('[Foto Share] Target Slack: #fotoai');

  let lastProcessedText = '';
  let shareButtonContainer = null;
  let currentChallenge = null;

  // Extract challenge data from chat messages
  function extractChallengeData() {
    const iframe = document.querySelector('iframe[src*="abacus"]');
    if (!iframe) {
      console.log('[Foto Email] No chatbot iframe found');
      return null;
    }

    try {
      // Try to access iframe content (may be blocked by CORS)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        console.log('[Foto Email] Cannot access iframe content (CORS)');
        return extractFromVisibleElements();
      }

      const messages = iframeDoc.querySelectorAll('[class*="message"], [class*="chat"], p, div');
      return parseMessagesForChallenge(messages);
    } catch (e) {
      console.log('[Foto Email] CORS blocked, using alternative detection');
      return extractFromVisibleElements();
    }
  }

  // Alternative: Look for photography challenge content on the visible page
  function extractFromVisibleElements() {
    const pageText = document.body.innerText;
    
    console.log('[Foto Email] Looking for challenge data in visible content...');
    
    // Simple approach: Look for photography terms in visible text
    const photographyTerms = [
      'aperture', 'shutter', 'iso', 'f/', '1/', 'mm lens', 'focal',
      'exposure', 'photograph', 'camera', 'shoot', 'capture',
      'street', 'portrait', 'landscape', 'golden hour', 'composition',
      'framing', 'focus', 'lighting', 'gear', 'tips'
    ];
    
    const lowerText = pageText.toLowerCase();
    const matchCount = photographyTerms.filter(term => lowerText.includes(term)).length;
    
    console.log('[Foto Email] Photography terms found:', matchCount);
    
    // If we see photography content, extract it
    if (matchCount >= 3) {
      // Extract meaningful lines (skip short lines and UI elements)
      const lines = pageText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 20 && l.length < 500)
        .filter(l => !/(^Home|^About|^Dashboard|^Chat|^Sign|Welcome to Foto|Get personalized|©|Menu|Navigation)/i.test(l));
      
      if (lines.length >= 2) {
        const challengeText = lines.slice(0, 3).join(' ').substring(0, 150);
        const description = lines.join('\n\n');
        
        console.log('[Foto Email] ✅ Extracted challenge from visible text');
        return {
          challengeText: challengeText || 'Photography Challenge',
          detailedDescription: description,
          _source: 'visible_text',
          _confidence: matchCount
        };
      }
    }
    
    // Fallback: Structure-based detection
    console.log('[Foto Email] Trying structure-based detection...');
    
    // STRICT: Look for actual challenge structure markers
    const structureMarkers = [
      /\bdifficulty\s*:?\s*(beginner|intermediate|advanced)/i,
      /\b(shooting\s+)?tips?\s*:?\s*/i,
      /\b(recommended\s+)?gear\s*(recommendations?|needed)?\s*:?\s*/i,
      /\bduration\s*:?\s*\d+/i,
      /\bfocal length\s*:?\s*\d+mm/i,
      /\baperture\s*:?\s*f\//i,
      /\bshutter speed\s*:?\s*1\//i,
      /\bISO\s*:?\s*\d+/i,
      /\btime of day\s*:?\s*(morning|afternoon|evening|golden hour)/i,
      /\blocation\s*:?\s*/i,
      /\bweather\s*:?\s*/i
    ];
    
    // Patterns to EXCLUDE (welcome text, UI prompts, examples)
    const excludePatterns = [
      /^["'].*["']$/,  // Quoted example prompts
      /Get personalized/i,
      /Tell me about your/i,
      /I have a /i,
      /Create a .* itinerary/i,
      /Give me a .* challenge/i,
      /Professional AI photography/i,
      /^(Home|About|Dashboard|Chat|Locations|Profile|Settings|Sign|Login|Logout)/i,
      /^Foto - /i,
      /©.*\d{4}/,
      /Terms|Privacy|Cookie/i,
      /Menu|Navigation/i,
      /specializing in/i,
      /based creative/i,
      /designed to elevate/i
    ];
    
    // Split into lines and look for challenge structure
    const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 15);
    
    let challengeContent = [];
    let structureMarkersFound = 0;
    let excludedContent = false;
    
    for (const line of lines) {
      // Skip excluded patterns (UI prompts, examples, welcome text)
      if (excludePatterns.some(pattern => pattern.test(line))) {
        console.log('[Foto Email] Skipping excluded line:', line.substring(0, 50));
        excludedContent = true;
        continue;
      }
      
      // Look for structure markers
      const hasStructure = structureMarkers.some(pattern => pattern.test(line));
      
      if (hasStructure) {
        structureMarkersFound++;
        challengeContent.push(line);
        console.log('[Foto Email] Found structure marker in:', line.substring(0, 50));
      }
    }
    
    // STRICT: Need at least 2 structure markers to be considered a real challenge
    if (structureMarkersFound >= 2 && challengeContent.length >= 2) {
      console.log('[Foto Email] ✅ Found challenge with', structureMarkersFound, 'structure markers');
      
      // Find the challenge title/description (usually first substantial line)
      let challengeTitle = 'Photography Challenge';
      for (const line of lines) {
        if (line.length > 30 && line.length < 150 && 
            !excludePatterns.some(p => p.test(line)) &&
            /challenge|photograph|shoot|capture/i.test(line)) {
          challengeTitle = line;
          break;
        }
      }
      
      const structureChallenge = {
        challengeText: challengeTitle,
        detailedDescription: challengeContent.join('\n\n'),
        _source: 'structure_detection',
        _confidence: structureMarkersFound
      };
      
      return structureChallenge;
    }
    
    // If we found excluded content but no valid structure, it's definitely not a challenge
    if (excludedContent) {
      console.log('[Foto Email] ⚠️ Found welcome/UI text but no challenge structure - skipping');
      return null;
    }
    
    console.log('[Foto Email] ⚠️ No challenge data found');
    console.log('[Foto Email] Tip: Chatbot should output CHALLENGE_SYNC_DATA for best results');
    return null;
  }

  // Parse messages for challenge data
  function parseMessagesForChallenge(messages) {
    // Implementation similar to extractFromVisibleElements
    // but working within iframe context
    return extractFromVisibleElements();
  }

  // Create and show share buttons (Email + Slack)
  function showEmailButton(challenge) {
    if (shareButtonContainer) {
      // Update existing buttons
      shareButtonContainer.style.display = 'flex';
      currentChallenge = challenge;
      return;
    }

    // Create button container
    shareButtonContainer = document.createElement('div');
    shareButtonContainer.id = 'foto-share-btns';
    shareButtonContainer.innerHTML = `
      <button class="foto-share-btn foto-email-btn" data-action="email">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="M22 6l-10 7L2 6"/>
        </svg>
        <span>Email</span>
      </button>
      <button class="foto-share-btn foto-slack-btn" data-action="slack">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
        <span>Slack</span>
      </button>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #foto-share-btns {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        gap: 8px;
        animation: slideInUp 0.3s ease-out;
      }

      .foto-share-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .foto-email-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .foto-slack-btn {
        background: linear-gradient(135deg, #4A154B 0%, #611f69 100%);
        box-shadow: 0 4px 12px rgba(74, 21, 75, 0.4);
      }

      .foto-share-btn:hover {
        transform: translateY(-2px);
      }

      .foto-email-btn:hover {
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
      }

      .foto-slack-btn:hover {
        box-shadow: 0 6px 20px rgba(74, 21, 75, 0.5);
      }

      .foto-share-btn:active {
        transform: translateY(0);
      }

      .foto-share-btn.sending {
        opacity: 0.7;
        pointer-events: none;
      }

      .foto-share-btn.success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
      }

      .foto-share-btn.error {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
      }

      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 640px) {
        #foto-share-btns {
          bottom: 16px;
          right: 16px;
          flex-direction: column;
        }
        
        .foto-share-btn {
          padding: 10px 14px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(style);

    // Add click handlers
    const emailBtn = shareButtonContainer.querySelector('[data-action="email"]');
    const slackBtn = shareButtonContainer.querySelector('[data-action="slack"]');
    
    emailBtn.addEventListener('click', () => sendChallengeEmail(challenge));
    slackBtn.addEventListener('click', () => sendChallengeSlack(challenge));

    // Add to page
    document.body.appendChild(shareButtonContainer);
    currentChallenge = challenge;

    console.log('[Foto Share] Buttons added to page (Email + Slack)');
  }

  // Hide share buttons
  function hideEmailButton() {
    if (shareButtonContainer) {
      shareButtonContainer.style.display = 'none';
    }
  }

  // Send challenge via email
  async function sendChallengeEmail(challenge) {
    const btn = shareButtonContainer.querySelector('[data-action="email"]');
    const originalText = btn.innerHTML;
    
    btn.classList.add('sending');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" opacity="0.3"/>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" style="animation: spin 1s linear infinite"/>
      </svg>
      <span>Sending...</span>
    `;

    try {
      // Log what we're sending
      console.log('[Foto Email] Sending challenge data:', challenge);
      
      const response = await fetch('/api/challenges/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...challenge,
          userEmail: 'seun_salami@outlook.com'
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Success
        btn.classList.remove('sending');
        btn.classList.add('success');
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Sent! Check Your Email</span>
        `;

        console.log('[Foto Email] ✅ Challenge emailed successfully');

        // Show notification
        showNotification('✅ Challenge emailed to seun_salami@outlook.com!', 'success');

        // Reset button after 3 seconds
        setTimeout(() => {
          btn.classList.remove('success');
          btn.innerHTML = originalText;
        }, 3000);
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('[Foto Email] ❌ Error:', error);
      
      btn.classList.remove('sending');
      btn.classList.add('error');
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>Failed. Try Again</span>
      `;

      showNotification('❌ Failed to send email. Please try again.', 'error');

      // Reset button after 3 seconds
      setTimeout(() => {
        btn.classList.remove('error');
        btn.innerHTML = originalText;
      }, 3000);
    }
  }

  // Send challenge via Slack
  async function sendChallengeSlack(challenge) {
    const btn = shareButtonContainer.querySelector('[data-action="slack"]');
    const originalText = btn.innerHTML;
    
    btn.classList.add('sending');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" opacity="0.3"/>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" style="animation: spin 1s linear infinite"/>
      </svg>
      <span>Sending...</span>
    `;

    try {
      console.log('[Foto Slack] Sending challenge data:', challenge);
      
      const response = await fetch('/api/challenges/slack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(challenge)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        btn.classList.remove('sending');
        btn.classList.add('success');
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Sent to #fotoai!</span>
        `;

        console.log('[Foto Slack] ✅ Challenge sent to Slack');
        showNotification('✅ Challenge sent to #fotoai on Slack!', 'success');

        setTimeout(() => {
          btn.classList.remove('success');
          btn.innerHTML = originalText;
        }, 3000);
      } else {
        throw new Error(result.error || 'Failed to send to Slack');
      }
    } catch (error) {
      console.error('[Foto Slack] ❌ Error:', error);
      
      btn.classList.remove('sending');
      btn.classList.add('error');
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>Failed</span>
      `;

      showNotification('❌ Failed to send to Slack. Please try again.', 'error');

      setTimeout(() => {
        btn.classList.remove('error');
        btn.innerHTML = originalText;
      }, 3000);
    }
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'foto-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#667eea'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideInDown 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Monitor for challenges
  function monitorForChallenges() {
    const challenge = extractChallengeData();
    
    if (challenge && challenge.challengeText) {
      const challengeKey = JSON.stringify(challenge);
      
      if (challengeKey !== lastProcessedText) {
        console.log('[Foto Email] 🎯 New challenge detected:', challenge.challengeText);
        lastProcessedText = challengeKey;
        showEmailButton(challenge);
      }
    } else {
      // No challenge detected
      if (lastProcessedText) {
        console.log('[Foto Email] No challenge visible');
      }
    }
  }

  // Initialize monitoring
  function init() {
    console.log('[Foto Email] 🚀 Initializing email button...');

    // Monitor every 2 seconds
    setInterval(monitorForChallenges, 2000);

    // Also monitor immediately
    monitorForChallenges();

    // Monitor when user scrolls or interacts
    document.addEventListener('scroll', monitorForChallenges);
    document.addEventListener('click', () => setTimeout(monitorForChallenges, 500));
  }

  // Make init function globally available
  window.initEmailChallengeButton = init;

  // Auto-initialize if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
