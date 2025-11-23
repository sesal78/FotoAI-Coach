/**
 * Foto Challenge Sync Integration
 * Automatically syncs AI-generated photography challenges to the dashboard
 */

(function() {
  'use strict';
  
  const SYNC_API_URL = 'https://myfoto.topues.com/api/challenges/sync';
  const USER_ID = '1'; // Default user ID
  
  console.log('[Foto Challenge Sync] Script loaded');
  
  /**
   * Extract challenge data from chatbot message
   */
  function extractChallengeData(messageText) {
    try {
      // Look for CHALLENGE_SYNC_DATA block in the message
      const dataMatch = messageText.match(/CHALLENGE_SYNC_DATA:\s*({[\s\S]*?})\s*(?:---|$)/);
      
      if (dataMatch && dataMatch[1]) {
        const challengeData = JSON.parse(dataMatch[1]);
        console.log('[Foto Challenge Sync] Extracted challenge data:', challengeData);
        return challengeData;
      }
      
      // Fallback: Try to extract from structured message
      const challenge = {
        userId: USER_ID,
        challengeText: '',
        category: '',
        difficulty: '',
        duration: '',
        location: '',
        recommendedGear: [],
        tips: '',
        weatherConditions: ''
      };
      
      // Extract challenge text (main content)
      const challengeMatch = messageText.match(/(?:Challenge|Assignment|Exercise):\s*([^\n]+(?:\n(?!Category|Difficulty|Duration|Location|Gear|Tips|Weather)[^\n]+)*)/i);
      if (challengeMatch) {
        challenge.challengeText = challengeMatch[1].trim();
      }
      
      // Extract category
      const categoryMatch = messageText.match(/Category:\s*([^\n]+)/i);
      if (categoryMatch) {
        challenge.category = categoryMatch[1].trim();
      }
      
      // Extract difficulty
      const difficultyMatch = messageText.match(/Difficulty:\s*(Micro|Mini|Deep Dive)/i);
      if (difficultyMatch) {
        challenge.difficulty = difficultyMatch[1].trim();
      }
      
      // Extract duration
      const durationMatch = messageText.match(/Duration:\s*([^\n]+)/i);
      if (durationMatch) {
        challenge.duration = durationMatch[1].trim();
      }
      
      // Extract location
      const locationMatch = messageText.match(/Location:\s*([^\n]+)/i);
      if (locationMatch) {
        challenge.location = locationMatch[1].trim();
      }
      
      // Extract recommended gear
      const gearMatch = messageText.match(/(?:Recommended )?Gear:\s*([^\n]+)/i);
      if (gearMatch) {
        challenge.recommendedGear = gearMatch[1].split(',').map(g => g.trim());
      }
      
      // Extract tips
      const tipsMatch = messageText.match(/Tips?:\s*([^\n]+(?:\n(?!Category|Difficulty|Duration|Location|Gear|Weather)[^\n]+)*)/i);
      if (tipsMatch) {
        challenge.tips = tipsMatch[1].trim();
      }
      
      // Extract weather conditions
      const weatherMatch = messageText.match(/Weather:\s*([^\n]+)/i);
      if (weatherMatch) {
        challenge.weatherConditions = weatherMatch[1].trim();
      }
      
      // Only return if we have at least challenge text
      if (challenge.challengeText) {
        console.log('[Foto Challenge Sync] Extracted challenge data (fallback):', challenge);
        return challenge;
      }
      
      return null;
    } catch (error) {
      console.error('[Foto Challenge Sync] Error extracting challenge data:', error);
      return null;
    }
  }
  
  /**
   * Sync challenge to dashboard
   */
  async function syncChallenge(challengeData) {
    try {
      console.log('[Foto Challenge Sync] Syncing to dashboard...', challengeData);
      
      const response = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(challengeData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[Foto Challenge Sync] Sync successful:', result);
        showNotification('✅ Challenge saved to your dashboard!', 'success');
        return true;
      } else {
        const errorText = await response.text();
        console.error('[Foto Challenge Sync] Sync failed:', response.status, errorText);
        showNotification('⚠️ Challenge generated but couldn\'t be saved to dashboard. Please try again later.', 'warning');
        return false;
      }
    } catch (error) {
      console.error('[Foto Challenge Sync] Network error:', error);
      showNotification('⚠️ Challenge generated but couldn\'t be saved to dashboard. Please try again later.', 'error');
      return false;
    }
  }
  
  /**
   * Show notification to user
   */
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `foto-sync-notification foto-sync-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#ef4444'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
  
  /**
   * Monitor chatbot messages
   */
  function monitorChatbotMessages() {
    console.log('[Foto Challenge Sync] Starting message monitor');
    
    // Use MutationObserver to watch for new messages
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            // Look for chatbot message containers
            const messages = node.querySelectorAll ? 
              node.querySelectorAll('[class*="message"], [class*="chat"], [data-message-type]') : 
              [];
            
            if (messages.length === 0 && node.textContent) {
              // Check the node itself
              processMessage(node);
            } else {
              messages.forEach(processMessage);
            }
          }
        });
      });
    });
    
    // Start observing the document body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[Foto Challenge Sync] Message monitor active');
  }
  
  /**
   * Process a message node
   */
  function processMessage(messageNode) {
    const messageText = messageNode.textContent || messageNode.innerText || '';
    
    // Check if this looks like a challenge message
    const isChallengeMessage = 
      /challenge|assignment|exercise|shoot|photography task/i.test(messageText) &&
      (messageText.includes('CHALLENGE_SYNC_DATA') || 
       /category|difficulty|duration|gear/i.test(messageText));
    
    if (isChallengeMessage) {
      console.log('[Foto Challenge Sync] Challenge message detected');
      
      const challengeData = extractChallengeData(messageText);
      
      if (challengeData) {
        // Avoid duplicate syncs
        if (!messageNode.dataset.fotoSynced) {
          messageNode.dataset.fotoSynced = 'true';
          syncChallenge(challengeData);
        }
      }
    }
  }
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitorChatbotMessages);
  } else {
    monitorChatbotMessages();
  }
})();
