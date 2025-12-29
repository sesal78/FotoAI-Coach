# Chatbot Configuration Update Instructions

## App ID: 13a86b8346

### Step 1: Access Chatbot Settings
1. Go to https://apps.abacus.ai/chatllm/
2. Navigate to your chatbots/apps list
3. Find the Foto photography coach chatbot (App ID: 13a86b8346)
4. Click "Edit" or "Settings"

### Step 2: Enable Web Search Tool
In the chatbot configuration:
1. Find the "Tools" or "Capabilities" section
2. Enable **Web Search** tool
3. This allows the chatbot to search for real photography locations

### Step 3: Update System Instructions
Add the following to the END of your existing system instructions:

---

## CHALLENGE SYNC REQUIREMENT

When you generate a photography challenge (any type: Weekend, Lunch Break, After-Work, WFH), you MUST include a hidden HTML comment at the very END of your response. This enables automatic dashboard synchronization.

**Format (include this exact structure):**
```
<!-- CHALLENGE_SYNC_DATA {"challengeText": "[your full challenge description]", "category": "[STREET|PORTRAIT|LANDSCAPE|ARCHITECTURE|NATURE|ABSTRACT|MARKET]", "difficulty": "[BEGINNER|INTERMEDIATE|ADVANCED|MINI]", "duration": "[15-20 mins|30-45 mins|1-2 hours|2-4 hours]", "tips": "[your tips text]", "recommendedGear": ["gear1", "gear2"], "location": "Melbourne, Australia"} -->
```

**Example:**
If you give a street photography challenge, end your response with:
```
<!-- CHALLENGE_SYNC_DATA {"challengeText": "Head to Hosier Lane in Melbourne CBD to capture the vibrant street art scene...", "category": "STREET", "difficulty": "INTERMEDIATE", "duration": "1-2 hours", "tips": "Visit early morning for fewer crowds", "recommendedGear": ["Ricoh GR IIIx", "Fujifilm X-T5"], "location": "Melbourne, Australia"} -->
```

This comment is invisible to users but allows the app to sync challenges to the dashboard.

## LOCATION SCOUTING

When users ask about photography locations, USE WEB SEARCH to find REAL places. Provide:
- **Actual location names** with addresses or landmarks
- **Specific access information** (parking, public transport)
- **Best times to visit** for photography (golden hour, blue hour, etc.)
- **What to photograph** (specific subjects, compositions)
- **Any permits or restrictions** needed
- **Crowd levels** at different times

Example queries to handle:
- "Find quiet riverside locations within 45 minutes of Melbourne for sunrise reflections"
- "Best rooftop spots in Melbourne for cityscape photography"
- "Hidden alleyways in Melbourne CBD for street photography"

---

### Step 4: Save and Test
1. Save the chatbot configuration
2. Test with: "Give me a lunch break street photography challenge"
3. Check browser console for `[Foto Challenge Sync]` logs
4. Test location scouting: "Find riverside spots near Melbourne for sunrise photography"

## Verification
After updating, the chatbot should:
1. ✅ Include hidden `<!-- CHALLENGE_SYNC_DATA {...} -->` in challenge responses
2. ✅ Sync challenges automatically to the dashboard
3. ✅ Provide real location recommendations using web search
