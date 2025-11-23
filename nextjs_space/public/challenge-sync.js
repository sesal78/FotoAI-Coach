/**
 * Foto Challenge Sync Integration v3
 * Automatically syncs AI-generated photography challenges to the dashboard
 * Handles visible JSON and hides it from display
 * NOW SUPPORTS: CHALLENGE_SYNC_DATA blocks
 */

(function() {
  'use strict';
  
  const SYNC_API_URL = 'https://myfoto.topues.com/api/challenges/sync';
  const USER_ID = '1';
  
  console.log('[Foto Challenge Sync v3] Script loaded');
  
  /**
   * Extract challenge data from HTML or text
   */
  function extractAndHideJSON(element) {
    const html = element.innerHTML || '';
    const text = element.textContent || '';
    
    // Method 1: Check for HTML comment with CHALLENGE_SYNC_DATA
    const commentPattern = /<!--\s*CHALLENGE_SYNC_DATA\s*([\s\S]*?)\s*-->/;
    const commentMatch = html.match(commentPattern);
    
    if (commentMatch) {
      console.log('[Foto Challenge Sync] Found CHALLENGE_SYNC_DATA in HTML comment!');
      const jsonText = commentMatch[1].trim();
      
      try {
        const challengeData = JSON.parse(jsonText);
        console.log('[Foto Challenge Sync] ✅ Extracted challenge from HTML comment:', challengeData);
        
        // Comment is already hidden - no need to hide element
        // Just remove the comment from DOM to clean up
        element.innerHTML = element.innerHTML.replace(commentMatch[0], '');
        
        return challengeData;
      } catch (error) {
        console.error('[Foto Challenge Sync] JSON parse error in comment:', error);
      }
    }
    
    // Method 2: Match CHALLENGE_SYNC_DATA block (visible format - legacy)
    if (text.includes('CHALLENGE_SYNC_DATA')) {
      console.log('[Foto Challenge Sync] Found visible CHALLENGE_SYNC_DATA block!');
      
      // Extract JSON after the label
      const jsonPattern = /\{[\s\S]*?"challengeText"\s*:[\s\S]*?\}/;
      const match = text.match(jsonPattern);
      
      if (match) {
        try {
          const challengeData = JSON.parse(match[0]);
          console.log('[Foto Challenge Sync] ✅ Extracted challenge from visible CHALLENGE_SYNC_DATA:', challengeData);
          
          // Hide the ENTIRE element (including label)
          hideEntireElement(element);
          
          return challengeData;
        } catch (error) {
          console.error('[Foto Challenge Sync] JSON parse error:', error);
        }
      }
    }
    
    // Method 3: Match standalone JSON (old format - legacy)
    const jsonPattern = /\{[\s\S]*?"challengeText"\s*:\s*"[\s\S]*?"[\s\S]*?\}/;
    const match = text.match(jsonPattern);
    
    if (!match) return null;
    
    try {
      const challengeData = JSON.parse(match[0]);
      console.log('[Foto Challenge Sync] ✅ Extracted challenge from standalone JSON:', challengeData);
      
      // Hide the JSON from display
      hideJSONElement(element, match[0]);
      
      return challengeData;
    } catch (error) {
      console.error('[Foto Challenge Sync] JSON parse error:', error);
      return null;
    }
  }
  
  /**
   * Hide entire element completely (for CHALLENGE_SYNC_DATA blocks)
   */
  function hideEntireElement(element) {
    console.log('[Foto Challenge Sync] 🚫 Hiding entire element');
    element.style.display = 'none';
    element.style.opacity = '0';
    element.style.visibility = 'hidden';
    element.style.height = '0';
    element.style.overflow = 'hidden';
    element.setAttribute('data-foto-hidden', 'true');
  }
  
  /**
   * Hide JSON element from display
   */
  function hideJSONElement(element, jsonText) {
    // Immediately hide to prevent flash
    element.style.opacity = '0';
    element.style.visibility = 'hidden';
    
    // Replace JSON with empty string
    const newText = element.textContent.replace(jsonText, '');
    
    // If element only contains JSON and separators, hide it completely
    if (newText.trim().match(/^[-\s]*$/) || newText.trim() === '' || newText.includes('CHALLENGE_SYNC_DATA')) {
      hideEntireElement(element);
      console.log('[Foto Challenge Sync] 🚫 Hidden empty element');
    } else {
      // Otherwise just remove the JSON part and show cleaned text
      element.textContent = newText.trim();
      element.style.opacity = '1';
      element.style.visibility = 'visible';
      console.log('[Foto Challenge Sync] ✂️ Removed JSON from element');
    }
  }
  
  /**
   * Sync challenge to dashboard
   */
  async function syncChallenge(challengeData) {
    const payload = {
      userId: USER_ID,
      ...challengeData
    };
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Foto Challenge Sync] 🚀 Starting sync...');
    console.log('[Foto Challenge Sync] 📦 Payload:', payload);
    console.log('[Foto Challenge Sync] 🎯 Endpoint:', SYNC_API_URL);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const response = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
      
      console.log('[Foto Challenge Sync] 📡 Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('[Foto Challenge Sync] ✅ SUCCESS!');
        console.log('[Foto Challenge Sync] 📊 Result:', result);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        showNotification('✅ Challenge saved to your dashboard!', 'success');
        
        // Log to help user verify
        console.log('🎯 Go to dashboard to see the challenge: https://myfoto.topues.com/dashboard');
        
        return true;
      } else {
        const errorText = await response.text();
        console.error('[Foto Challenge Sync] ❌ FAILED!');
        console.error('[Foto Challenge Sync] Status:', response.status);
        console.error('[Foto Challenge Sync] Error:', errorText);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        showNotification('⚠️ Could not save to dashboard (check console)', 'warning');
        return false;
      }
    } catch (error) {
      console.error('[Foto Challenge Sync] ❌ NETWORK ERROR!');
      console.error('[Foto Challenge Sync] Error:', error);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      showNotification('⚠️ Network error - could not save to dashboard', 'error');
      return false;
    }
  }
  
  /**
   * Show notification
   */
  function showNotification(message, type = 'info') {
    const colors = {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    };
    
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${colors[type]};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
  
  /**
   * Process a node for challenge data
   */
  function processNode(node) {
    if (!node || node.nodeType !== 1) return; // Only process element nodes
    if (node.dataset?.fotoProcessed) return;
    
    const text = node.textContent || '';
    
    // Priority 1: Check for CHALLENGE_SYNC_DATA block
    if (text.includes('CHALLENGE_SYNC_DATA')) {
      console.log('[Foto Challenge Sync] 🎯 Found CHALLENGE_SYNC_DATA block!');
      
      const challengeData = extractAndHideJSON(node);
      
      if (challengeData) {
        node.dataset.fotoProcessed = 'true';
        syncChallenge(challengeData);
        return;
      }
    }
    
    // Priority 2: Check if contains challenge JSON
    if (text.includes('"challengeText"') && text.includes('"category"')) {
      console.log('[Foto Challenge Sync] 📝 Found challenge JSON in node');
      
      const challengeData = extractAndHideJSON(node);
      
      if (challengeData) {
        node.dataset.fotoProcessed = 'true';
        syncChallenge(challengeData);
      }
    }
  }
  
  /**
   * Monitor for new content
   */
  function startMonitoring() {
    console.log('[Foto Challenge Sync] Starting monitor...');
    
    // Process existing content immediately
    document.querySelectorAll('*').forEach(processNode);
    
    // Watch for new content with high frequency
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Process immediately to minimize flash
            processNode(node);
            node.querySelectorAll?.('*').forEach(processNode);
          } else if (node.nodeType === 3 && node.textContent.includes('"challengeText"')) {
            // Text node with JSON - process parent
            processNode(node.parentElement);
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true
    });
    
    // Also poll aggressively for first 5 seconds
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      document.querySelectorAll('*').forEach(processNode);
      pollCount++;
      if (pollCount >= 50) clearInterval(pollInterval); // Stop after 5 seconds
    }, 100);
    
    console.log('[Foto Challenge Sync] Monitor active ✓');
  }
  
  // Add animations and proactive hiding
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
    
    /* Proactively hide CHALLENGE_SYNC_DATA blocks */
    *:has-text("CHALLENGE_SYNC_DATA") {
      display: none !important;
    }
    [data-foto-hidden="true"] {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
    }
  `;
  document.head.appendChild(style);
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
  } else {
    startMonitoring();
  }
})();
