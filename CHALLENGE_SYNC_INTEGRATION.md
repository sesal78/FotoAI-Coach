# Foto Challenge Sync Integration Guide

## Overview
This guide explains how to integrate the automatic challenge synchronization feature into your Foto Next.js application. The chatbot will now automatically save generated photography challenges to your dashboard at `https://myfoto.topues.com`.

## What's Been Updated

### 1. Chatbot Model (Abacus.AI)
- **Model ID**: `395b215e`
- **New Version**: `158402f8ca`
- **Deployment**: Active at `https://apps.abacus.ai/chatllm/13a86b8346`
- **New Capability**: Automatically detects challenge requests and embeds structured metadata in responses

### 2. Frontend Integration Script
- **File**: `challenge-sync.js`
- **Purpose**: Monitors chatbot messages, extracts challenge data, and syncs to dashboard
- **Location**: Should be placed in `/public` directory of your Next.js app

## Integration Steps

### Step 1: Copy the Sync Script

```bash
# Copy challenge-sync.js to your Next.js public directory
cp challenge-sync.js ~/foto_app/nextjs_space/public/
```

### Step 2: Update Your Chat Page

Add the script to your chat page component. Update `pages/chat.js` (or wherever your chat page is):

```jsx
import Script from 'next/script';

export default function ChatPage() {
  return (
    <div>
      {/* Your existing chat page content */}
      <iframe 
        src="https://apps.abacus.ai/chatllm/13a86b8346"
        style={{ width: '100%', height: '100vh', border: 'none' }}
      />
      
      {/* Add the challenge sync script */}
      <Script 
        src="/challenge-sync.js" 
        strategy="afterInteractive"
      />
    </div>
  );
}
```

### Step 3: Test the Integration

1. Start your Next.js development server:
   ```bash
   cd ~/foto_app/nextjs_space
   npm run dev
   ```

2. Open your chat page in a browser

3. Ask the chatbot for a challenge:
   - "Give me a photography challenge"
   - "What should I shoot today?"
   - "Create a street photography exercise"

4. Watch for:
   - Console logs: `[Foto Challenge Sync] ...`
   - Success notification: "✅ Challenge saved to your dashboard!"
   - Challenge appearing on your dashboard at `https://myfoto.topues.com`

## How It Works

### Challenge Detection
The chatbot automatically detects when you're requesting a photography challenge based on keywords like:
- "challenge"
- "exercise"
- "what should I shoot"
- "give me an assignment"

### Data Extraction
The chatbot embeds structured data in its response:

```
CHALLENGE_SYNC_DATA:
{
  "userId": "1",
  "challengeText": "Capture the interplay of light and shadow...",
  "category": "Street",
  "difficulty": "Mini",
  "duration": "30-45 mins",
  "location": "Melbourne CBD",
  "recommendedGear": ["Ricoh GR IIIx", "Fujifilm X-T5"],
  "tips": "Look for strong directional light...",
  "weatherConditions": "Partly cloudy, golden hour"
}
```

### API Sync
The frontend script:
1. Monitors chatbot messages using MutationObserver
2. Extracts the `CHALLENGE_SYNC_DATA` JSON
3. POSTs to `https://myfoto.topues.com/api/challenges/sync`
4. Shows success/failure notification

## API Payload Structure

```json
{
  "userId": "1",
  "challengeText": "Full challenge description",
  "category": "Street|Portrait|Landscape|Macro|Architecture|etc.",
  "difficulty": "Micro|Mini|Deep Dive",
  "duration": "15-20 mins|1-2 hours|etc.",
  "location": "Specific location if mentioned",
  "recommendedGear": ["Gear item 1", "Gear item 2"],
  "tips": "Pro tips for the challenge",
  "weatherConditions": "Weather info if relevant"
}
```

## Troubleshooting

### Challenge Not Syncing

1. **Check Console Logs**:
   - Open browser DevTools (F12)
   - Look for `[Foto Challenge Sync]` messages
   - Check for errors

2. **Verify API Endpoint**:
   ```bash
   curl -X POST https://myfoto.topues.com/api/challenges/sync \
     -H "Content-Type: application/json" \
     -d '{"userId":"1","challengeText":"Test"}'
   ```

3. **Check Script Loading**:
   - Verify `challenge-sync.js` is in `/public` directory
   - Check Network tab in DevTools for 404 errors

### Notification Not Showing

1. Check if notification is blocked by other elements (z-index)
2. Look for JavaScript errors in console
3. Verify the notification CSS is being applied

### Duplicate Syncs

The script prevents duplicates using `data-foto-synced` attribute. If you see duplicates:
- Clear browser cache
- Check for multiple script instances
- Verify MutationObserver is working correctly

## Testing Prompts

Try these prompts to test the integration:

1. **Basic Challenge**:
   - "Give me a street photography challenge"

2. **Location-Specific**:
   - "Create a challenge for Melbourne CBD"

3. **Gear-Specific**:
   - "Give me a challenge using my Ricoh GR IIIx"

4. **Difficulty-Specific**:
   - "Give me a quick 15-minute micro challenge"
   - "Create a deep dive challenge for the weekend"

5. **Category-Specific**:
   - "Give me a portrait photography exercise"
   - "Create a landscape challenge"

## Configuration

### Change User ID
Edit `challenge-sync.js`:
```javascript
const USER_ID = '1'; // Change to your user ID
```

### Change API Endpoint
Edit `challenge-sync.js`:
```javascript
const SYNC_API_URL = 'https://your-domain.com/api/challenges/sync';
```

### Customize Notifications
Modify the `showNotification` function in `challenge-sync.js` to change:
- Position
- Colors
- Duration
- Animation

## Next Steps

1. ✅ Copy `challenge-sync.js` to your Next.js `/public` directory
2. ✅ Update your chat page to include the script
3. ✅ Test with various challenge prompts
4. ✅ Verify challenges appear on your dashboard
5. ✅ Monitor console logs for any issues

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify your API endpoint is accessible
3. Test the chatbot directly at `https://apps.abacus.ai/chatllm/13a86b8346`
4. Ensure your dashboard API is accepting POST requests

---

**Chatbot URL**: https://apps.abacus.ai/chatllm/13a86b8346  
**Dashboard URL**: https://myfoto.topues.com  
**API Endpoint**: https://myfoto.topues.com/api/challenges/sync
