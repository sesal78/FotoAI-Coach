
# 🔧 Dashboard Troubleshooting Guide

## Current Status

✅ **Database**: Connected and seeded with user data
✅ **API**: Challenge generation working (`/api/challenges`)
✅ **Build**: Next.js compiles successfully
⚠️ **Dashboard**: Some buttons reported as not working

---

## Quick Diagnostic Steps

### 1. Test Challenge Generation API

```bash
cd ~/foto_app/nextjs_space

# Test API directly
curl -X POST http://localhost:3000/api/challenges \
  -H "Content-Type: application/json" \
  -d '{"userId": "1", "challengeType": "LUNCH_MICRO", "forceGenerate": true}' | jq .
```

**Expected**: Should return a challenge object with `challengeText`, `tips`, `recommendedGear`, etc.

---

### 2. Check Database for User

```bash
cd ~/foto_app/nextjs_space
node check_user.js
```

**Expected Output**:
```
✅ Users found: 7

- ID: 1
  Email: seun@example.com
  Name: Seun
  Preferences: YES
  Gear: 4 items
```

---

### 3. Test Dashboard in Browser

1. Open your deployed URL: **https://myfoto.topues.com/dashboard**
2. Open browser DevTools (F12)
3. Go to **Console** tab
4. Click "Generate New Challenge" button
5. Check for errors in console

**Common Errors:**

#### ❌ "User ID required"
**Fix**: Dashboard is using hardcoded `userId: '1'`. Make sure this user exists (run step 2).

#### ❌ "Failed to generate challenge"
**Fix**: Check API logs for specific error. Could be:
- LLM API key invalid
- Weather API failing
- Database connection issue

#### ❌ "Network error" / "Failed to fetch"
**Fix**: API route not responding. Check if Next.js dev server is running.

---

### 4. Check Environment Variables

```bash
cd ~/foto_app/nextjs_space
cat .env
```

**Required Variables:**
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `ABACUSAI_API_KEY` - For LLM challenge generation
- ✅ `OPENWEATHERMAP_API_KEY` - For weather integration
- ✅ `SENDGRID_API_KEY` - For email notifications (optional)
- ✅ `NEXTAUTH_SECRET` - For authentication

---

### 5. Check Server Logs

**If using development server:**
```bash
cd ~/foto_app/nextjs_space
yarn dev
# Watch console for errors
```

**If deployed:**
- Check deployment logs on your hosting platform
- Look for API route errors
- Check database connection errors

---

## Common Issues & Solutions

### Issue 1: "Generate New Challenge" Button Does Nothing

**Symptoms:**
- Button clicks but nothing happens
- No error messages
- No new challenge appears

**Debug:**
```javascript
// Open browser console on dashboard
// Try running this directly:
fetch('/api/challenges', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: '1',
    challengeType: 'WEEKEND_DEEP_DIVE',
    forceGenerate: true
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Possible Causes:**
1. ❌ API key missing/invalid → Check `.env` file
2. ❌ Database not seeded → Run `node check_user.js`
3. ❌ Network issue → Check browser network tab
4. ❌ CORS issue → Check if deployed URL matches `NEXTAUTH_URL`

---

### Issue 2: Tab Buttons Don't Switch Content

**Symptoms:**
- Clicking "History" or "Itinerary" tabs doesn't change view
- Tabs look inactive

**Solution:**
This is normal! The tabs are **navigation tabs**, not action buttons. They should work correctly in the browser.

The test tool may report them as "inactive buttons" because they're tab triggers (role="tab"), not action buttons.

**Test in Browser:**
1. Open https://myfoto.topues.com/dashboard
2. Click "History" tab → Should show past challenges
3. Click "Itinerary" tab → Should show "Coming soon" message

---

### Issue 3: Challenge Generation Fails with Error

**Symptoms:**
- Error toast appears
- Console shows "Failed to generate challenge"

**Debug Steps:**

**Step 1: Check LLM API**
```bash
# Test Abacus.AI API directly
curl -X POST https://apps.abacus.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ABACUSAI_API_KEY" \
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 50
  }'
```

Expected: Should return a chat completion response.

**Step 2: Check Weather API**
```bash
# Test OpenWeatherMap API
curl "http://api.openweathermap.org/data/2.5/weather?q=San%20Francisco&appid=YOUR_OPENWEATHERMAP_API_KEY&units=imperial"
```

Expected: Should return weather data for San Francisco.

**Step 3: Check Database Connection**
```bash
cd ~/foto_app/nextjs_space
yarn prisma db push
```

Expected: "The database is already in sync with the Prisma schema."

---

### Issue 4: "Error: undefined" on Button Click

**Cause**: The error response format doesn't match what the frontend expects.

**Check API Response Format**:
```bash
curl -X POST http://localhost:3000/api/challenges \
  -H "Content-Type: application/json" \
  -d '{"userId": "1", "challengeType": "LUNCH_MICRO", "forceGenerate": true}' \
  | jq .
```

**Expected Format:**
```json
{
  "challenge": {
    "id": "...",
    "challengeText": "...",
    "difficulty": "...",
    "category": "...",
    "duration": "...",
    "tips": "...",
    "recommendedGear": [...]
  },
  "message": "Challenge generated successfully"
}
```

**If Error:**
```json
{
  "error": "Specific error message here"
}
```

**Fix**: Update error handling in `app/dashboard/page.tsx`:
```typescript
if (response.ok) {
  setCurrentChallenge(data.challenge);
  toast.success('New challenge generated!');
} else {
  // Handle both .error and .message fields
  toast.error(data.error || data.message || 'Failed to generate challenge');
}
```

---

## Testing Checklist

Run through this checklist to verify everything works:

### ✅ Backend Tests

- [ ] Database connected: `node check_user.js` shows user
- [ ] Prisma client generated: `yarn prisma generate` succeeds
- [ ] Schema in sync: `yarn prisma db push` confirms sync
- [ ] API responds: `curl http://localhost:3000/api/health` returns 200

### ✅ API Tests

- [ ] Challenge generation works: POST to `/api/challenges` returns challenge
- [ ] Progress endpoint works: GET `/api/progress?userId=1` returns progress
- [ ] Challenges list works: GET `/api/challenges?userId=1` returns challenges

### ✅ Frontend Tests

- [ ] Dashboard loads: Visit https://myfoto.topues.com/dashboard
- [ ] No console errors: Check browser DevTools console
- [ ] Tabs work: Click "History" and "Itinerary" tabs
- [ ] Generate button works: Click "Generate New Challenge"
- [ ] Toast notifications appear: Success/error messages display

---

## Deployment Checklist

If deploying to production:

### 1. Update Environment Variables

```bash
# On your deployment platform, set:
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://myfoto.topues.com
NEXTAUTH_SECRET=...
ABACUSAI_API_KEY=...
OPENWEATHERMAP_API_KEY=...
SENDGRID_API_KEY=...
```

### 2. Run Migrations

```bash
yarn prisma migrate deploy
# or
yarn prisma db push
```

### 3. Seed Database

```bash
yarn prisma db seed
# or run custom seed script
```

### 4. Test Deployment

```bash
# Test health endpoint
curl https://myfoto.topues.com/api/health

# Test challenge generation
curl -X POST https://myfoto.topues.com/api/challenges \
  -H "Content-Type: application/json" \
  -d '{"userId": "1", "challengeType": "LUNCH_MICRO", "forceGenerate": true}'
```

---

## Emergency Debug Commands

### View All Environment Variables
```bash
cd ~/foto_app/nextjs_space && cat .env
```

### Check Database Contents
```bash
cd ~/foto_app/nextjs_space && node check_user.js
```

### Rebuild Everything
```bash
cd ~/foto_app/nextjs_space
yarn install
yarn prisma generate
yarn prisma db push
yarn build
```

### Start Fresh Dev Server
```bash
cd ~/foto_app/nextjs_space
pkill node  # Kill existing servers
yarn dev
```

---

## Getting Help

If issues persist, provide these details:

1. **Exact error message** (from browser console)
2. **API response** (from curl test)
3. **Environment** (development/production)
4. **Database status** (output of `node check_user.js`)
5. **Server logs** (console output when clicking button)

---

## Summary

Your Foto App has two main components:

1. **Next.js Web App** (`/home/ubuntu/foto_app/nextjs_space`)
   - Running at: https://myfoto.topues.com
   - Has dashboard with challenge generation
   - Uses its own Prisma database

2. **FastAPI Backend** (`/home/ubuntu/foto_ai_agent`)
   - Running at: https://fotoai.topues.com
   - Separate API service
   - Different database

**Current Status:**
- ✅ API endpoint works (tested with curl)
- ✅ Database has user data
- ✅ Challenge generation succeeds
- ⚠️ Need to verify in actual browser

**Next Step:** Open https://myfoto.topues.com/dashboard in browser and try generating a challenge!
