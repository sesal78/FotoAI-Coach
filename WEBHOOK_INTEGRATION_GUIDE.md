# 🔗 Webhook Integration Guide for Foto Challenge Sync

## Overview

This guide shows how to integrate your Foto chatbot with the challenge sync API using Abacus.AI webhooks. This enables **automatic, invisible challenge syncing** without any visible JSON or manual intervention.

---

## 🎯 Architecture

```
User asks for challenge
         ↓
Chatbot generates challenge
         ↓
Chatbot calls webhook → https://myfoto.topues.com/api/challenges/sync
         ↓
Challenge saved to database
         ↓
Dashboard auto-updates
         ↓
User sees challenge (no JSON visible!)
```

---

## 📋 Prerequisites

1. ✅ Your Foto app is deployed at: `https://myfoto.topues.com`
2. ✅ API endpoint exists: `/api/challenges/sync`
3. ✅ You have access to Abacus.AI chatbot settings

---

## 🛠️ Setup Instructions

### Step 1: Access Chatbot Settings

1. Go to your chatbot on Abacus.AI
2. Click on **"Deployment"** or **"Settings"**
3. Look for **"Webhooks"** or **"Add New Webhook"** button

### Step 2: Configure Webhook

**Webhook Configuration:**

| Field | Value |
|-------|-------|
| **Name** | Foto Challenge Sync |
| **URL** | `https://myfoto.topues.com/api/challenges/sync` |
| **Method** | `POST` |
| **Content-Type** | `application/json` |
| **Event Type** | `On Assistant Response` (or `After Message`) |

### Step 3: Configure Payload Template

**Option A: If webhook supports custom payload template:**

```json
{
  "userId": "1",
  "challengeText": "{{challenge_title}}",
  "category": "{{category}}",
  "difficulty": "{{difficulty}}",
  "duration": "{{duration}}",
  "location": "{{location}}",
  "recommendedGear": "{{gear}}",
  "tips": "{{tips}}",
  "weatherConditions": "{{weather}}"
}
```

**Option B: If using default payload:**

The chatbot will need to format the JSON in its response, which the webhook will forward.

### Step 4: Update Chatbot Instructions

**Replace the current CHALLENGE_SYNC_DATA instructions with:**

---

## 🤖 Chatbot System Prompt (Webhook Version)

When a user requests a photography challenge, follow this format:

### Natural Language Response (What Users See)

```
🎯 **[Challenge Name]**

[2-3 sentences describing the challenge]

📍 **Location:** [Specific location or "Flexible"]
⏱️ **Duration:** [e.g., "30 minutes"]
📸 **Recommended Gear:** [Specific gear from Seun's collection]
🌤️ **Weather:** [Weather conditions]

💡 **Shooting Tips:**
- [Tip 1]
- [Tip 2]
- [Tip 3]

**Creative Twist:** [Unique element]

**Reflection Prompt:** [Question for evaluation]

✅ **Challenge saved to your dashboard!**
```

### Webhook Trigger

**After generating the challenge description, call the webhook with this JSON:**

```json
{
  "userId": "1",
  "challengeText": "[Challenge title exactly as shown above]",
  "category": "STREET",
  "difficulty": "MINI",
  "duration": "30 minutes",
  "location": "[Location from description]",
  "recommendedGear": "[Gear from description]",
  "tips": "[Brief summary of tips]",
  "weatherConditions": "[Weather from description]"
}
```

**IMPORTANT RULES:**
1. **NO VISIBLE JSON** in the chat response
2. **Call webhook immediately** after generating description
3. **Match data** between description and webhook payload
4. **Use valid values** for category and difficulty

### Valid Values

**Categories (pick ONE):**
- PORTRAIT
- LANDSCAPE
- STREET
- MARKET
- ARCHITECTURE
- NATURE
- ABSTRACT

**Difficulty (pick ONE):**
- BEGINNER (simple, 30 min - 1 hour)
- INTERMEDIATE (moderate, 1-2 hours)
- ADVANCED (challenging, 2+ hours)
- MINI (quick, 15-30 minutes)

---

## ✅ Complete Example

**User asks:** "Give me a street photography challenge"

**Chatbot response (visible):**

```
🎯 **Urban Geometry: Lines & Shapes in the City**

Today's challenge is all about discovering the hidden patterns and bold shapes that make city life so visually dynamic! Head out and hunt for strong lines, repeating shapes, and geometric forms.

📍 **Location:** Flexible (any urban area)
⏱️ **Duration:** 30 minutes
📸 **Recommended Gear:** Fujifilm X-T5 with 23mm f/2 lens
🌤️ **Weather:** Any

💡 **Shooting Tips:**
- Look for leading lines that guide the viewer's eye
- Use a low or high angle to exaggerate shapes
- Pay attention to light and shadow for contrast

**Creative Twist:** Shoot only in black and white mode to focus purely on form.

**Reflection Prompt:** Which image surprised you most, and how did focusing on geometry change the way you saw your surroundings?

✅ **Challenge saved to your dashboard!**
```

**Webhook payload (sent automatically, NOT visible to user):**

```json
{
  "userId": "1",
  "challengeText": "Urban Geometry: Lines & Shapes in the City",
  "category": "STREET",
  "difficulty": "MINI",
  "duration": "30 minutes",
  "location": "Flexible",
  "recommendedGear": "Fujifilm X-T5 with 23mm f/2 lens",
  "tips": "Look for leading lines, use low or high angles, pay attention to light and shadow",
  "weatherConditions": "Any"
}
```

**Result:**
- ✅ User sees clean, inspiring challenge description
- ✅ NO JSON clutter in the chat
- ✅ Challenge automatically appears on dashboard
- ✅ Seamless user experience!

---

## 🧪 Testing the Integration

### Test 1: Webhook Configuration

1. After configuring the webhook, use the **"Test Webhook"** button (if available)
2. Check the response status code: **200 OK** means success

### Test 2: API Direct Test

Test the API endpoint directly:

```bash
curl -X POST https://myfoto.topues.com/api/challenges/sync \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "1",
    "challengeText": "Test Challenge",
    "category": "STREET",
    "difficulty": "MINI",
    "duration": "30 minutes",
    "location": "Flexible",
    "recommendedGear": "Fujifilm X-T5 with 23mm f/2 lens",
    "tips": "Test tips",
    "weatherConditions": "Any"
  }'
```

**Expected response:**

```json
{
  "success": true,
  "challenge": {
    "id": "...",
    "challengeText": "Test Challenge",
    "category": "STREET",
    ...
  },
  "created": true
}
```

### Test 3: End-to-End Test

1. Go to: **https://myfoto.topues.com/chat**
2. Ask: **"Give me a street photography challenge"**
3. **Expected results:**
   - ✅ Clean challenge description appears
   - ✅ NO JSON visible
   - ✅ "Challenge saved to your dashboard!" message
4. Go to: **https://myfoto.topues.com/dashboard**
5. Wait 10 seconds (auto-refresh)
6. **Expected result:**
   - ✅ Challenge appears in "Current Challenge" tab

---

## 🔍 Troubleshooting

### Issue: Webhook not triggering

**Possible causes:**
- Webhook URL incorrect
- Event type not configured properly
- Chatbot not calling webhook

**Solutions:**
1. Check webhook configuration in Abacus.AI settings
2. Verify webhook URL: `https://myfoto.topues.com/api/challenges/sync`
3. Check webhook logs in Abacus.AI dashboard

### Issue: Challenge not appearing on dashboard

**Possible causes:**
- API call failed
- Invalid data format
- Database error

**Solutions:**
1. Check API response in webhook logs
2. Verify JSON payload matches expected format
3. Test API endpoint directly (see Test 2 above)

### Issue: Webhook returns error

**Common errors:**

| Status Code | Meaning | Solution |
|-------------|---------|----------|
| 400 | Missing required fields | Check payload includes `userId` and `challengeText` |
| 404 | Endpoint not found | Verify webhook URL is correct |
| 500 | Server error | Check server logs for details |

---

## 📊 API Endpoint Reference

### POST /api/challenges/sync

**Description:** Creates or updates a challenge in the database.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "string (required)",
  "challengeText": "string (required)",
  "category": "string (optional)",
  "difficulty": "string (optional)",
  "duration": "string (optional)",
  "location": "string (optional)",
  "recommendedGear": "string (optional)",
  "tips": "string (optional)",
  "weatherConditions": "string (optional)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "challenge": {
    "id": "string",
    "userId": "string",
    "challengeText": "string",
    "category": "string",
    "difficulty": "string",
    ...
  },
  "created": true  // or "updated": true if existing challenge was updated
}
```

**Response (Error):**
```json
{
  "error": "string",
  "details": "string (optional)"
}
```

---

## 🎯 Advantages of Webhook Integration

✅ **No visible JSON** - Users never see any technical data  
✅ **Automatic sync** - No manual intervention required  
✅ **Reliable** - Direct API call from server to server  
✅ **Real-time** - Challenge appears immediately on dashboard  
✅ **Clean UX** - Professional, seamless user experience  
✅ **No iframe limitations** - Bypasses cross-origin restrictions  
✅ **Future-proof** - Easy to extend with additional features

---

## 📚 Alternative: Custom Tool (If Webhook Not Available)

If webhook integration is not available in your chatbot plan, you can use a **Custom Tool** instead:

### Custom Tool Configuration

**Tool Name:** `save_challenge_to_dashboard`

**Tool Description:** "Saves a photography challenge to the user's dashboard"

**Parameters:**
```python
{
  "type": "object",
  "properties": {
    "challengeText": {"type": "string", "description": "Title of the challenge"},
    "category": {"type": "string", "enum": ["PORTRAIT", "LANDSCAPE", "STREET", "MARKET", "ARCHITECTURE", "NATURE", "ABSTRACT"]},
    "difficulty": {"type": "string", "enum": ["BEGINNER", "INTERMEDIATE", "ADVANCED", "MINI"]},
    "duration": {"type": "string", "description": "Duration (e.g., '30 minutes')"},
    "location": {"type": "string", "description": "Location for the challenge"},
    "recommendedGear": {"type": "string", "description": "Recommended gear"},
    "tips": {"type": "string", "description": "Photography tips"},
    "weatherConditions": {"type": "string", "description": "Weather conditions"}
  },
  "required": ["challengeText"]
}
```

**Tool Implementation:**
```python
import requests

def save_challenge_to_dashboard(challengeText, category="STREET", difficulty="MINI", 
                                 duration="30 minutes", location="Flexible", 
                                 recommendedGear="", tips="", weatherConditions="Any"):
    url = "https://myfoto.topues.com/api/challenges/sync"
    payload = {
        "userId": "1",
        "challengeText": challengeText,
        "category": category,
        "difficulty": difficulty,
        "duration": duration,
        "location": location,
        "recommendedGear": recommendedGear,
        "tips": tips,
        "weatherConditions": weatherConditions
    }
    
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    return response.json()
```

---

## 🚀 Next Steps

1. **Configure webhook** in Abacus.AI chatbot settings
2. **Update chatbot instructions** to use webhook format
3. **Test** the integration end-to-end
4. **Verify** challenge appears on dashboard
5. **Celebrate!** 🎉 You now have seamless challenge sync!

---

## 📞 Support

If you encounter any issues:

1. Check webhook logs in Abacus.AI dashboard
2. Test API endpoint directly with curl
3. Check browser console on chat page for errors
4. Verify chatbot instructions are correct

---

**Status:** Production-ready webhook integration ✅  
**Last Updated:** November 23, 2025  
**Version:** 1.0

---
