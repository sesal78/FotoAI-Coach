
/**
 * Email Challenge Button - Foto AI
 * Detects challenges in chat and provides one-click email delivery
 * Version: 2024123002 (Hybrid Detection)
 * Target Email: seun_salami@outlook.com
 * Updates: 
 * - BEST: Structured CHALLENGE_SYNC_DATA format (when chatbot provides it)
 * - FALLBACK: Flexible detection with keyword matching (works now!)
 * - Filters out UI elements to prevent false positives
 * - Shows button for any photography challenge content
 */

(function() {
  'use strict';

  console.log('[Foto Email] Script loaded - Version: 2024123002 (Hybrid Detection)');
  console.log('[Foto Email] Target email: seun_salami@outlook.com');

  let lastProcessedText = '';
  let emailButton = null;
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

  // Alternative: Look for structured CHALLENGE_SYNC_DATA or flexible challenge content
  function extractFromVisibleElements() {
    const pageText = document.body.innerText;
    const pageHTML = document.body.innerHTML;
    
    console.log('[Foto Email] Looking for challenge data...');
    
    // Method 1: Look for structured CHALLENGE_SYNC_DATA in text (BEST)
    if (pageText.includes('CHALLENGE_SYNC_DATA')) {
      console.log('[Foto Email] Found CHALLENGE_SYNC_DATA marker!');
      
      // Extract JSON after the label
      const jsonPattern = /\{[\s\S]*?"challengeText"\s*:[\s\S]*?\}/;
      const match = pageText.match(jsonPattern);
      
      if (match) {
        try {
          const challengeData = JSON.parse(match[0]);
          console.log('[Foto Email] ✅ Extracted structured challenge data:', challengeData);
          return challengeData;
        } catch (error) {
          console.error('[Foto Email] JSON parse error:', error);
        }
      }
    }
    
    // Method 2: Look for HTML comment with CHALLENGE_SYNC_DATA
    const commentPattern = /<!--\s*CHALLENGE_SYNC_DATA\s*([\s\S]*?)\s*-->/;
    const commentMatch = pageHTML.match(commentPattern);
    
    if (commentMatch) {
      console.log('[Foto Email] Found CHALLENGE_SYNC_DATA in HTML comment!');
      const jsonText = commentMatch[1].trim();
      
      try {
        const challengeData = JSON.parse(jsonText);
        console.log('[Foto Email] ✅ Extracted challenge from HTML comment:', challengeData);
        return challengeData;
      } catch (error) {
        console.error('[Foto Email] JSON parse error in comment:', error);
      }
    }
    
    // Method 3: Look for standalone JSON object with challengeText
    const jsonPattern = /\{[\s\S]*?"challengeText"\s*:\s*"[^"]*?"[\s\S]*?\}/;
    const match = pageText.match(jsonPattern);
    
    if (match) {
      try {
        const challengeData = JSON.parse(match[0]);
        console.log('[Foto Email] ✅ Extracted standalone JSON:', challengeData);
        return challengeData;
      } catch (error) {
        console.error('[Foto Email] JSON parse error:', error);
      }
    }
    
    // Method 4: FALLBACK - Flexible detection for challenges without structured data
    // This helps when chatbot doesn't output CHALLENGE_SYNC_DATA format yet
    console.log('[Foto Email] No structured data found, trying flexible detection...');
    
    // Filter out UI elements and navigation
    const uiPatterns = [
      /^(Home|About|Dashboard|Chat|Locations|Profile|Settings|Sign|Login|Logout)/i,
      /^Foto - /i,
      /©.*\d{4}/,
      /Terms|Privacy|Cookie/i,
      /Menu|Navigation/i
    ];
    
    // Look for photography challenge indicators
    const challengeKeywords = [
      'challenge', 'photography', 'shoot', 'capture', 'photo',
      'camera', 'lens', 'composition', 'lighting', 'portrait',
      'landscape', 'street', 'difficulty', 'beginner', 'intermediate',
      'advanced', 'melbourne', 'tips', 'gear'
    ];
    
    // Split into lines and find challenge-like content
    const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 20);
    
    let challengeContent = [];
    let foundKeywords = new Set();
    
    for (const line of lines) {
      // Skip UI elements
      if (uiPatterns.some(pattern => pattern.test(line))) {
        continue;
      }
      
      // Count challenge keywords in this line
      const keywordsInLine = challengeKeywords.filter(keyword => 
        line.toLowerCase().includes(keyword)
      );
      
      if (keywordsInLine.length >= 2) {
        challengeContent.push(line);
        keywordsInLine.forEach(k => foundKeywords.add(k));
      }
    }
    
    // If we found enough challenge-related content, create a basic challenge object
    if (challengeContent.length >= 2 && foundKeywords.size >= 3) {
      console.log('[Foto Email] ✅ Found flexible challenge content');
      console.log('[Foto Email] Keywords detected:', Array.from(foundKeywords).join(', '));
      
      // Extract title (first meaningful line)
      const challengeText = challengeContent[0].substring(0, 80);
      
      // Build flexible challenge object
      const flexibleChallenge = {
        challengeText: challengeText,
        detailedDescription: challengeContent.join('\n\n'),
        _source: 'flexible_detection'
      };
      
      console.log('[Foto Email] Flexible challenge:', flexibleChallenge);
      return flexibleChallenge;
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

  // Create and show email button
  function showEmailButton(challenge) {
    if (emailButton) {
      // Update existing button
      emailButton.style.display = 'flex';
      currentChallenge = challenge;
      return;
    }

    // Create button
    emailButton = document.createElement('div');
    emailButton.id = 'foto-email-challenge-btn';
    emailButton.innerHTML = `
      <button class="foto-email-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="M22 6l-10 7L2 6"/>
        </svg>
        <span>Email This Challenge</span>
      </button>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #foto-email-challenge-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        animation: slideInUp 0.3s ease-out;
      }

      .foto-email-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: all 0.2s ease;
      }

      .foto-email-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
      }

      .foto-email-btn:active {
        transform: translateY(0);
      }

      .foto-email-btn.sending {
        opacity: 0.7;
        pointer-events: none;
      }

      .foto-email-btn.success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      }

      .foto-email-btn.error {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
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
        #foto-email-challenge-btn {
          bottom: 16px;
          right: 16px;
        }
        
        .foto-email-btn {
          padding: 10px 16px;
          font-size: 13px;
        }
      }
    `;
    document.head.appendChild(style);

    // Add click handler
    const btn = emailButton.querySelector('.foto-email-btn');
    btn.addEventListener('click', () => sendChallengeEmail(challenge));

    // Add to page
    document.body.appendChild(emailButton);
    currentChallenge = challenge;

    console.log('[Foto Email] Button added to page');
  }

  // Hide email button
  function hideEmailButton() {
    if (emailButton) {
      emailButton.style.display = 'none';
    }
  }

  // Send challenge via email
  async function sendChallengeEmail(challenge) {
    const btn = emailButton.querySelector('.foto-email-btn');
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
