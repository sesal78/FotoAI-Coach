# Chatbot Behavior Update Required

## Issue
The chatbot is currently outputting challenge metadata as visible JSON on the page, which looks unprofessional.

## Solution
Update the chatbot's behavior instructions to output the JSON in a hidden HTML comment or at the very end after separator lines.

## Updated Instruction to Add

Add this to the chatbot's **Response Instructions**:

```
**Challenge Metadata Output:**
When generating a photography challenge, you MUST include the challenge metadata at the END of your response in this EXACT format:

---
<!-- CHALLENGE_SYNC_DATA
{
  "challengeText": "[Complete challenge description]",
  "category": "[Category]",
  "difficulty": "[Micro/Mini/Deep Dive]",
  "duration": "[Duration]",
  "location": "[Location or Flexible]",
  "recommendedGear": ["gear1", "gear2"],
  "tips": "[Tips summary]",
  "weatherConditions": "[Weather or Any conditions]"
}
-->

The metadata MUST be:
1. Placed at the very end of your response
2. After the "---" separator
3. Inside an HTML comment (<!-- -->)
4. Valid JSON format
5. Include all required fields

This ensures the metadata is hidden from users but accessible to the sync script.
```

## How to Update

1. Go to Abacus.AI chatbot editor: https://apps.abacus.ai/chatllm/13a86b8346
2. Click "Edit" or "Settings"
3. Find "Response Instructions" section
4. Add the above instruction
5. Save and redeploy

## Alternative Format (If HTML comments don't work)

If the chatbot strips HTML comments, use this format instead:

```
---
CHALLENGE_SYNC_DATA:
{
  "challengeText": "...",
  "category": "...",
  ...
}
---
```

Then update the frontend script to look for this pattern and hide everything between the markers.

## Testing

After updating:
1. Ask chatbot: "Give me a photography challenge"
2. Verify the JSON is hidden from view
3. Check browser console for sync confirmation
4. Verify challenge appears on dashboard

