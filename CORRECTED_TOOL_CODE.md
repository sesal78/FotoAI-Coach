
# ✅ Corrected Tool Code - Copy This Exactly

## Python Function Code

**Copy this ENTIRE code block and paste it into your tool editor:**

```python
import requests
import json
from typing import Dict, List, Optional

def sync_challenge_to_dashboard(
    challenge_text: str,
    category: str,
    difficulty: str,
    duration: str,
    location: str = "Flexible",
    recommended_gear: str = "",
    tips: str = "",
    weather_conditions: str = "Any"
) -> Dict:
    """
    Syncs a photography challenge to the Foto dashboard.
    
    Args:
        challenge_text: Title/name of the photography challenge
        category: Photography category (STREET, PORTRAIT, LANDSCAPE, MARKET, ARCHITECTURE, NATURE, ABSTRACT)
        difficulty: Challenge difficulty level (BEGINNER, INTERMEDIATE, ADVANCED, MINI)
        duration: Estimated time to complete (e.g., "30 minutes", "1-2 hours")
        location: Specific location or "Flexible"
        recommended_gear: Camera gear recommendation
        tips: Photography tips and guidance
        weather_conditions: Weather conditions for the challenge
    
    Returns:
        Dict with success status and message
    """
    
    # API endpoint
    url = "https://myfoto.topues.com/api/challenges/sync"
    
    # Build payload
    payload = {
        "userId": "1",
        "challengeText": challenge_text,
        "category": category,
        "difficulty": difficulty,
        "duration": duration,
        "location": location,
        "recommendedGear": recommended_gear,
        "tips": tips,
        "weatherConditions": weather_conditions
    }
    
    # Make API call
    try:
        response = requests.post(
            url,
            json=payload,
            headers={
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        # Check response
        response.raise_for_status()
        result = response.json()
        
        return {
            "success": True,
            "message": "Challenge synced successfully to dashboard!",
            "challenge_id": result.get("challenge", {}).get("id", ""),
            "data": result
        }
        
    except requests.exceptions.HTTPError as e:
        return {
            "success": False,
            "error": f"HTTP error: {e.response.status_code}",
            "details": e.response.text if e.response else str(e)
        }
    
    except requests.exceptions.ConnectionError as e:
        return {
            "success": False,
            "error": "Connection error - could not reach dashboard API",
            "details": str(e)
        }
    
    except requests.exceptions.Timeout as e:
        return {
            "success": False,
            "error": "Request timeout - dashboard API did not respond in time",
            "details": str(e)
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {type(e).__name__}",
            "details": str(e)
        }
```

---

## Key Fix

**Changed:** `weather_condition` (singular)  
**To:** `weather_conditions` (plural)

This matches the parameter name expected by your tool configuration.

---

## After Pasting

1. Click **"Update"** to save
2. The error should disappear
3. Proceed to test the tool

---

**Status:** Ready to paste  
**Last Updated:** November 24, 2025
