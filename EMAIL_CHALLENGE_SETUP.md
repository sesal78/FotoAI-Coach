
# 📧 Email Challenge Setup Guide

## Overview

This guide shows how to configure your Foto chatbot to email photography challenges on request.

---

## 🎯 How It Works

**User:** "Give me a street photography challenge"  
**Chatbot:** [Generates beautiful challenge description]  
**User:** "Send this to my email"  
**Chatbot:** [Calls email tool] "✅ Challenge sent to your email!"

---

## 🔧 Step 1: Create the Custom Tool

In your Abacus.AI Tools section, create a new tool called `email_challenge_to_user`.

### Tool Configuration

**Tool Name:** `email_challenge_to_user`  
**Tool Type:** Python Function  
**Description:** "Emails a photography challenge to the user"

### Python Code

```python
import requests
import json
from typing import Dict

def email_challenge_to_user(
    challenge_text: str,
    category: str = "",
    difficulty: str = "",
    duration: str = "",
    location: str = "",
    recommended_gear: str = "",
    tips: str = "",
    weather_conditions: str = "",
    user_email: str = "seunsamuel11@gmail.com"
) -> Dict:
    """
    Emails a photography challenge to the user.
    
    Args:
        challenge_text: Title/name of the photography challenge (required)
        category: Photography category (STREET, PORTRAIT, LANDSCAPE, etc.)
        difficulty: Challenge difficulty (BEGINNER, INTERMEDIATE, ADVANCED, MINI)
        duration: Estimated time (e.g., "30 minutes", "1-2 hours")
        location: Specific location or "Flexible"
        recommended_gear: Camera gear recommendation
        tips: Photography tips and guidance
        weather_conditions: Weather conditions for the challenge
        user_email: User's email address (default: seunsamuel11@gmail.com)
    
    Returns:
        Dict with success status and message
    """
    
    url = "https://myfoto.topues.com/api/challenges/email"
    
    payload = {
        "challengeText": challenge_text,
        "category": category,
        "difficulty": difficulty,
        "duration": duration,
        "location": location,
        "recommendedGear": recommended_gear,
        "tips": tips,
        "weatherConditions": weather_conditions,
        "userEmail": user_email
    }
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        response.raise_for_status()
        result = response.json()
        
        return {
            "success": True,
            "message": f"✅ Challenge emailed successfully to {user_email}!"
        }
        
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"Failed to send email: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }
```

### Tool Parameters

Configure these parameters (right panel):

1. **challenge_text** (string, required)
   - Description: "Title of the photography challenge"

2. **category** (string, optional)
   - Description: "Photography category"

3. **difficulty** (string, optional)
   - Description: "Challenge difficulty level"

4. **duration** (string, optional)
   - Description: "Estimated time to complete"

5. **location** (string, optional)
   - Description: "Location for the challenge"

6. **recommended_gear** (string, optional)
   - Description: "Camera gear recommendation"

7. **tips** (string, optional)
   - Description: "Photography tips"

8. **weather_conditions** (string, optional)
   - Description: "Weather conditions"

9. **user_email** (string, optional, default: "seunsamuel11@gmail.com")
   - Description: "User's email address"

---

## 📝 Step 2: Update Chatbot Response Instructions

Add this to your chatbot's response instructions:

---

## Email Delivery Feature

When users request a challenge to be emailed, use the `email_challenge_to_user` tool.

### When to Send Email

Call the email tool when user says:
- "Send this to my email"
- "Email me this challenge"
- "Can I get this via email?"
- "Send it to my inbox"
- Or any similar request

### How to Send Email

After generating a challenge, if the user requests email delivery:

```python
email_challenge_to_user(
    challenge_text="[Challenge title]",
    category="[Category]",
    difficulty="[Difficulty]",
    duration="[Duration]",
    location="[Location]",
    recommended_gear="[Gear]",
    tips="[Tips summary]",
    weather_conditions="[Weather]"
)
```

After calling the tool, confirm to the user:

✅ **Challenge emailed!** Check your inbox at seunsamuel11@gmail.com. The email includes all challenge details, tips, and gear recommendations in a beautifully formatted message.

### Example Workflow

**User:** "Give me a street photography challenge"

**You:** [Generate challenge description as normal]

**User:** "Send this to my email"

**You:** [Call email_challenge_to_user tool with all challenge details]

**You:** "✅ Challenge emailed! Check your inbox at seunsamuel11@gmail.com. The email includes all challenge details, tips, and gear recommendations in a beautifully formatted message."

---

## ✅ Step 3: Enable Tool for Chatbot

1. Save the tool
2. Test it with sample parameters
3. Go to your chatbot settings
4. Enable the `email_challenge_to_user` tool
5. Save changes

---

## 🧪 Step 4: Test the Feature

1. Go to: https://myfoto.topues.com/chat
2. Ask: "Give me a street photography challenge"
3. Chatbot generates challenge
4. Say: "Send this to my email"
5. Chatbot calls email tool
6. Check your inbox at seunsamuel11@gmail.com

**Expected Result:**
- ✅ Beautiful HTML email with challenge details
- ✅ All tips and recommendations included
- ✅ Link to dashboard

---

## 📧 Email Format

The email includes:
- Challenge title
- Category, difficulty, duration badges
- Location details
- Recommended gear
- Photography tips
- Weather conditions
- Link to dashboard

**Example:**

```
Subject: 📸 Your Photography Challenge: Urban Geometry

[Beautiful HTML email with gradient header]

🎯 Urban Geometry: Lines & Shapes in the City

📂 Category: STREET
⚡ Difficulty: INTERMEDIATE
⏱️ Duration: 45 minutes
📍 Location: Flinders Street Station area
📸 Recommended Gear: Fujifilm X-T5 with 23mm f/2 lens
🌤️ Weather: Partly cloudy

💡 Tips:
Look for leading lines, use low or high angles for drama...

[Link to dashboard button]
```

---

## 🎯 Benefits

✅ **On-demand delivery** - Only sends when user requests it  
✅ **No visible JSON** - Clean chat experience  
✅ **Beautiful emails** - Professionally formatted HTML  
✅ **All details included** - Complete challenge info  
✅ **Simple workflow** - Just ask to email it  

---

## 🐛 Troubleshooting

### Email not received

**Check:**
- SendGrid API key is configured in .env
- FROM_EMAIL is set in .env
- Email address is correct (seunsamuel11@gmail.com)
- Check spam folder

**Test manually:**
```bash
curl -X POST https://myfoto.topues.com/api/challenges/email \
  -H "Content-Type: application/json" \
  -d '{
    "challengeText": "Test Challenge",
    "category": "STREET",
    "difficulty": "MINI",
    "duration": "30 minutes",
    "userEmail": "seunsamuel11@gmail.com"
  }'
```

### Tool call fails

**Possible causes:**
- Tool not enabled for chatbot
- Network error
- API endpoint down

**Solution:**
- Verify tool is enabled
- Check chatbot has internet access
- Test API endpoint directly

---

## 📊 Summary

**What you did:**
1. ✅ Created `/api/challenges/email` endpoint
2. ✅ Configured `email_challenge_to_user` tool
3. ✅ Updated chatbot instructions
4. ✅ Tested the feature

**What users get:**
- Beautiful challenge descriptions in chat
- Option to request email delivery
- Professional HTML emails
- Simple, reliable workflow

---

**Status:** Production-ready email delivery  
**Last Updated:** November 24, 2025
