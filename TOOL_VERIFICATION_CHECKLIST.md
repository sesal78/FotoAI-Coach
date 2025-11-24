# ✅ Tool Verification Checklist

## 🔧 Step 1: Verify Tool Configuration

Click on the **"sync_challenge_to_dashboard"** tool and verify these settings:

### Required Settings

**Tool Name:** `sync_challenge_to_dashboard`  
**Tool Type:** Python Function  
**Description:** "Syncs a photography challenge to the Foto dashboard at myfoto.topues.com"

### Required Parameters

The tool MUST have these parameters (check the right panel):

1. **challenge_text** (string, required)
   - Description: "Title of the photography challenge"

2. **category** (string, required)
   - Description: "Photography category (STREET, PORTRAIT, LANDSCAPE, MARKET, ARCHITECTURE, NATURE, ABSTRACT)"

3. **difficulty** (string, required)
   - Description: "Challenge level (BEGINNER, INTERMEDIATE, ADVANCED, MINI)"

4. **duration** (string, required)
   - Description: "Estimated time (e.g., '30 minutes', '1-2 hours')"

5. **location** (string, optional)
   - Description: "Specific location or 'Flexible'"

6. **recommended_gear** (string, optional)
   - Description: "Camera gear recommendation"

7. **tips** (string, optional)
   - Description: "Photography tips"

8. **weather_condition** (string, optional)
   - Description: "Weather conditions"

### Python Code Verification

The tool's Python code should:
1. Import `requests` and `json`
2. Make a POST request to: `https://myfoto.topues.com/api/challenges/sync`
3. Include `userId: "1"` in the payload
4. Return success/error message

**Example code structure:**
```python
import requests
import json

def sync_challenge_to_dashboard(
    challenge_text: str,
    category: str,
    difficulty: str,
    duration: str,
    location: str = "Flexible",
    recommended_gear: str = "",
    tips: str = "",
    weather_condition: str = "Any"
):
    url = "https://myfoto.topues.com/api/challenges/sync"
    
    payload = {
        "userId": "1",
        "challengeText": challenge_text,
        "category": category,
        "difficulty": difficulty,
        "duration": duration,
        "location": location,
        "recommendedGear": recommended_gear,
        "tips": tips,
        "weatherConditions": weather_condition
    }
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        response.raise_for_status()
        return {"success": True, "message": "Challenge synced successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## 🧪 Step 2: Test the Tool

1. Click the **"Test"** or **"Run"** button on the tool
2. Fill in test parameters:
   ```
   challenge_text: "Test Challenge"
   category: "STREET"
   difficulty: "MINI"
   duration: "30 minutes"
   location: "Melbourne CBD"
   recommended_gear: "Fujifilm X-T5"
   tips: "Test tips"
   weather_condition: "Sunny"
   ```
3. Click **"Run Test"**
4. Expected result: `{"success": true, "message": "Challenge synced successfully"}`

---

## 🔗 Step 3: Enable Tool for Chatbot

1. Make sure the tool is **published** or **active**
2. Go to your chatbot settings
3. Look for **"Tools"** or **"Available Tools"** section
4. **Enable** the `sync_challenge_to_dashboard` tool
5. Save changes

---

## 📝 Step 4: Update Response Instructions

1. Go to your chatbot's **"Response Instructions"** section
2. **Copy the entire content** from `/home/ubuntu/foto_app/CHATBOT_INSTRUCTIONS_WITH_TOOL.md`
3. **Paste** it into the Response Instructions field
4. **Save** the changes

---

## ✅ Step 5: Test End-to-End

1. Go to: https://myfoto.topues.com/chat
2. Ask: "Give me a street photography challenge"
3. **Expected result:**
   - Beautiful challenge description (no JSON!)
   - Confirmation message: "✅ Challenge saved to your dashboard!"
4. Go to: https://myfoto.topues.com/dashboard
5. **Expected result:**
   - Challenge appears in "Current Challenge" tab
   - All details match the chat description

---

## 🐛 Troubleshooting

### Tool not appearing in chatbot

**Solution:** Make sure the tool is published/active and enabled for your chatbot.

### Tool call fails

**Possible issues:**
- URL incorrect (should be `https://myfoto.topues.com/api/challenges/sync`)
- Missing `userId` in payload
- Network/firewall blocking request

**Solution:** Check tool code and test manually.

### Challenge not appearing on dashboard

**Possible issues:**
- Tool call succeeded but wrong data format
- API validation error
- Database connection issue

**Solution:** Check browser console and API logs.

---

## 📊 Success Criteria

✅ Tool is configured with all required parameters  
✅ Tool test returns success  
✅ Tool is enabled for chatbot  
✅ Chatbot instructions updated  
✅ End-to-end test works  
✅ No JSON visible to users  
✅ Challenge appears on dashboard  

---

**When all checks pass, you have fully automatic challenge sync!** 🚀

---

**Last Updated:** November 24, 2025
