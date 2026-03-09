# Foto AI Coach Pro — Feature Roadmap v2

> Premium Feature Expansion: 6 phases transforming Foto from a basic challenge tool into a premium AI photography coaching platform.

---

## Guiding Principles

1. **Additive only** — No phase modifies or breaks existing features. Every phase adds new capability alongside what works today.
2. **Existing infrastructure first** — Reuse `callLLM()`, vision pipeline, Appwrite collections, React Query hooks, shadcn/ui components. No new external services unless unavoidable.
3. **Core loop integrity** — The existing loop (generate challenge -> shoot -> submit -> get critique) remains untouched. New features extend it, not replace it.
4. **Small phases first** — Quick wins (Phases 4-6) ship fast and build momentum before the larger phases (8-9).
5. **Each phase is independently valuable** — If we stop after any phase, the app is better than before.

---

## Current State (Pre-v2 Baseline)

| Area | What Exists |
|------|-------------|
| Pages | Landing, login, signup, onboarding, dashboard, progress, settings, critique, chat, locations, about |
| API routes | 28 routes — auth, challenges CRUD, submissions, critiques, itinerary, progress, scheduled jobs, settings |
| Appwrite collections | user_preferences, user_gear, daily_challenges, challenge_submissions, itineraries, user_progress, agent_actions, photo_critiques |
| LLM functions | `callLLM()`, `generateChallenge()`, `generateFeedback()`, `critiquePhoto()` (vision), `generateItinerary()` |
| Challenge types | WEEKEND_DEEP_DIVE, LUNCH_BREAK, AFTER_WORK, WFH_MICRO (time-based only) |
| UI framework | shadcn/ui + Tailwind CSS + recharts + framer-motion |

---

## Features NOT Selected (and Why)

| Feature (prompt.md section) | Reason for Exclusion |
|---|---|
| Real-time mobile camera (3.x) | Requires native mobile app (React Native/Expo). Current stack is Next.js web. Separate project, not an enhancement. |
| AR composition overlays (3.2) | Needs native camera access + GPU-accelerated overlays. Web browsers cannot do this reliably. |
| Voice-activated coach (3.3) | Always-on mic + speech-to-text + real-time LLM. High complexity, fragile, expensive API costs. |
| Peer critique / social network (5.1) | Requires multi-user matching, content moderation, karma/credit system, anti-abuse tooling. Massive scope increase with no existing social infrastructure. Needs critical user mass to be useful. |
| Photo battles / tournaments (5.2) | Tournament brackets require critical mass of concurrent users. Bad experience with small user base. |
| Study groups (5.3) | Group chat, video calls, cohort management — infrastructure-heavy social features premature for current stage. |
| Mentor matching (5.4) | User-base dependency + video call integration + structured mentorship tracking. Premature. |
| Client simulation lab (6.2) | Interesting but niche. Serves only users pursuing professional photography. Better after core platform matures. |
| Social media co-pilot (6.3) | Caption generation, hashtag suggestions, posting schedules — these compete with established tools (Later, Buffer). Dilutes coaching identity. |
| Business tools (6.4) | Invoices, contracts, expense tracking are generic business tools. They don't make the photography coaching better. Compete with HoneyBook, Wave, FreshBooks. |
| Film stock simulator (4.3) | Requires real image processing (Sharp/Canvas/WASM), not just LLM analysis. Different engineering domain. |
| Lens simulator (4.2) | Same — needs real image manipulation with perspective/DOF rendering. Not an LLM task. |
| Monetization/subscription tiers (10.x) | Important eventually, but premature. Build premium features first, gate them with Stripe later. Adding subscription management now adds complexity without value. |
| Batch consistency coach (7.3) | Analysing 50+ images for editing consistency is expensive (50 vision API calls) and niche. Better as a Phase 10+ feature. |
| Preset file generation (1.3 partial) | Generating actual .xmp/.lrtemplate files requires reverse-engineering Adobe formats. We take the educational instructions approach instead. |

---

## Phase 4 — "How to Recreate This" Reverse Engineering

> **prompt.md reference:** Section 1.2
> **Effort:** Small (1-2 sessions)
> **Premium impact:** HIGH

### What It Does
User uploads an inspiration photo (from Instagram, magazines, web) and the AI reverse-engineers how the shot was taken:

- Estimated camera settings (ISO, aperture, shutter speed)
- Time of day / lighting conditions (golden hour, studio, window light, etc.)
- Estimated focal length and lens type
- Lighting setup description (natural vs artificial, direction, modifiers)
- Camera position relative to subject
- Post-processing approach to match the look
- Step-by-step "shot recipe" to recreate it

### Why This Feature
- Photographers constantly ask "how did they get this shot?" — this answers it with AI
- Reuses the exact same vision pipeline as `critiquePhoto()` — same pattern, different prompt
- No new collections needed (can optionally save to a new `reverse_engineering` collection or reuse photo_critiques with a type field)
- Quick to build, immediately impressive, strong differentiation from free tools

### Technical Plan

| Component | Change |
|-----------|--------|
| `lib/llm.ts` | Add `reverseEngineerPhoto()` function — vision call with reverse-engineering prompt |
| `lib/types.ts` | Add `ReverseEngineeringResult` interface |
| `app/api/reverse-engineer/route.ts` | POST endpoint — accepts image upload, calls LLM, returns analysis |
| `app/critique/page.tsx` | Add "Recreate This" tab alongside existing critique tab (or new `/recreate` page) |
| `lib/appwrite-collections.ts` | Optional: add `COLLECTION_REVERSE_ANALYSES` if we want to persist history |
| `scripts/appwrite-setup.ts` | Optional: add reverse_analyses collection |

### Output Schema
```json
{
  "estimatedSettings": {
    "iso": "200-400",
    "aperture": "f/2.8",
    "shutterSpeed": "1/250s",
    "focalLength": "85mm",
    "meteringMode": "spot"
  },
  "lightingAnalysis": {
    "timeOfDay": "Golden hour (last 30 minutes before sunset)",
    "lightType": "Natural, single directional",
    "lightDirection": "Camera-left, 45 degrees",
    "modifiers": "None visible — open shade with reflected warm light"
  },
  "cameraPosition": "Eye level, approximately 3 meters from subject, slight upward angle",
  "lensType": "Short telephoto (85mm equivalent) — moderate background compression visible",
  "postProcessing": "Warm color grade, lifted shadows, desaturated greens, skin tone preservation, slight vignette",
  "shotRecipe": [
    "1. Scout location with open shade and warm reflected surfaces",
    "2. Position subject with light source at 45° camera-left",
    "3. Use 85mm at f/2.8 for subject isolation",
    "4. Expose for skin tones (+0.3 EV compensation)",
    "5. In post: warm white balance, lift blacks to +15, reduce green saturation"
  ],
  "difficultyToRecreate": "intermediate",
  "gearNeeded": ["85mm f/1.8 or similar short telephoto", "reflector (optional)"]
}
```

### Acceptance Criteria
- [ ] User can upload any photo on the recreate page/tab
- [ ] AI returns structured analysis within 10-15 seconds
- [ ] Results display clearly with sections for settings, lighting, processing
- [ ] Shot recipe is step-by-step and actionable
- [ ] Analysis adapts to user's skill level (simpler explanations for beginners)
- [ ] History of past analyses is viewable (if persistence added)

---

## Phase 5 — Enhanced Challenge System (Story-Driven + Technical Mastery)

> **prompt.md reference:** Sections 8.1, 8.2
> **Effort:** Small (1-2 sessions)
> **Premium impact:** HIGH

### What It Does
Adds two new challenge categories beyond the current time-based types:

**Story-Driven Challenges:**
- Narrative assignments with shot lists, mood context, and required shots
- Example: "Document a day in the life of a barista" — includes 8-shot list, interview tips, editing direction
- Example: "Create a photo essay on solitude" — mood board description, 5 required perspectives, tone guidance

**Technical Mastery Challenges:**
- Progressive difficulty chains organized by skill area
- Exposure: 5 levels from program mode → full manual studio lighting
- Focus: single point → tracking → back-button → zone focusing
- Composition: centered subject → rule of thirds → leading lines → layered depth → breaking rules intentionally

### Why This Feature
- Current challenges vary by *time slot* (Weekend, Lunch, AfterWork, WFH) but not by *learning objective*
- Story-driven challenges teach photojournalism and storytelling — the hardest skills to self-teach
- Technical mastery chains create a structured curriculum instead of random prompts
- This is what separates a free "daily photo prompt" app from a paid coaching platform
- Zero new infrastructure — same `generateChallenge()` pipeline with richer prompts and new type enum values

### Technical Plan

| Component | Change |
|-----------|--------|
| `lib/llm.ts` | Extend `generateChallenge()` — add `STORY_DRIVEN` and `TECHNICAL_MASTERY` types with richer prompt templates |
| `lib/types.ts` | Extend Challenge type — add `shotList?: string[]`, `technicalLevel?: number`, `masteryArea?: string`, `narrativeContext?: string` |
| `app/api/challenges/route.ts` | Handle new challenge types, include mastery progression tracking |
| Dashboard UI | Update challenge type selector to include Story-Driven and Technical Mastery with descriptions |
| `scripts/appwrite-setup.ts` | Add new attributes to `daily_challenges` collection (shotList, technicalLevel, masteryArea, narrativeContext) |

### New Challenge Type Definitions
```
STORY_DRIVEN:
  - complexity: "high — narrative assignment with shot list and editorial direction"
  - duration: "2-6 hours (can span a full day)"
  - focus: "Photojournalism, storytelling, essay construction"
  - output: includes shotList[], narrativeContext, editingDirection

TECHNICAL_MASTERY:
  - complexity: "progressive — locked to user's current mastery level"
  - duration: "30 mins - 2 hours depending on level"
  - focus: "Specific technical skill with measurable criteria"
  - output: includes masteryArea, technicalLevel (1-5), successCriteria, whatToLookFor
```

### Acceptance Criteria
- [ ] Challenge type selector shows all 6 types with clear descriptions
- [ ] Story-driven challenges include shot lists and narrative context
- [ ] Technical mastery challenges indicate current level and next unlock
- [ ] Generated challenges respect user's skill level and gear
- [ ] New fields persist correctly in Appwrite
- [ ] Existing challenge types (Weekend, Lunch, etc.) still work unchanged

---

## Phase 6 — Weekly Insights Report

> **prompt.md reference:** Section 9.2
> **Effort:** Small (1 session)
> **Premium impact:** HIGH

### What It Does
Auto-generated weekly summary delivered via email and viewable in-app:

- Photos submitted this week vs. last week (trend arrow)
- Average critique scores and trend (improving/declining)
- Skill area breakdown: "Composition scores up 15% this week"
- Gear usage stats: "85mm used in 60% of submissions"
- Challenge completion rate this week
- Streak status and record proximity
- Personalized AI recommendation: "Your landscape shots lack foreground interest — try this weekend's challenge"

### Why This Feature
- The data already exists across `user_progress`, `daily_challenges`, `challenge_submissions`, `photo_critiques`
- The scheduled endpoint pattern exists (`/api/scheduled/weekly-report`) — just needs data aggregation
- Makes users feel the platform is *actively tracking their growth* — massive retention driver
- Email delivery drives re-engagement for users who haven't opened the app
- In-app insights page creates a reason to check back weekly

### Technical Plan

| Component | Change |
|-----------|--------|
| `lib/llm.ts` | Add `generateWeeklyInsights()` — takes aggregated stats, returns personalized summary with recommendations |
| `app/api/scheduled/weekly-report/route.ts` | Enhance existing route — aggregate data from all collections, call LLM for personalized narrative, send email |
| `lib/email.ts` | Add `sendWeeklyReport()` email template — HTML formatted with stats, charts (inline), and recommendations |
| `app/progress/page.tsx` | Add "Weekly Insights" section at top of progress page showing latest report |
| Optional: `lib/appwrite-collections.ts` | Add `COLLECTION_WEEKLY_REPORTS` to persist generated reports for history |

### Data Aggregation Queries
```
From daily_challenges:     count by status (completed/pending/skipped) this week vs last
From challenge_submissions: count, average rating, category breakdown
From photo_critiques:       average scores by dimension, trend vs previous week
From user_gear:             cross-reference with submission metadata for gear usage
From user_progress:         streak, total completed, completion rate
```

### Acceptance Criteria
- [ ] Weekly report generates with accurate stats from real data
- [ ] Email sends with formatted HTML report
- [ ] Progress page shows latest weekly insights
- [ ] AI recommendation is personalized and actionable
- [ ] Report handles edge cases: new user with no data, user with no activity this week
- [ ] Scheduled endpoint works when called by cron

---

## Phase 7 — Editing Recipe Generator

> **prompt.md reference:** Section 1.3 (educational instructions approach, no preset file export)
> **Effort:** Small-Medium (1-2 sessions)
> **Premium impact:** MEDIUM-HIGH

### What It Does
User uploads two versions of a photo — the original (or raw) and their edited version:

- AI compares both images and identifies specific adjustments made
- Outputs slider-by-slider editing instructions (Lightroom/Capture One style)
- Identifies over-editing: "Saturation pushed too far — skin tones look unnatural"
- Suggests improvements: "Lift shadows +20 for detail recovery, reduce highlights -15"
- Explains the *why* behind each adjustment for learning purposes
- Side-by-side comparison display in the UI

### Why This Feature
- Post-processing is where most beginner/intermediate photographers get stuck
- Complements the critique engine perfectly: critique says *what's wrong*, editing recipe says *how to fix it*
- Uses existing vision pipeline (two images instead of one)
- Genuinely educational — users learn editing theory, not just "apply this preset"
- No preset file generation (complex Adobe format reverse-engineering) — focus on human-readable instructions

### Technical Plan

| Component | Change |
|-----------|--------|
| `lib/llm.ts` | Add `generateEditingRecipe()` — two-image vision call comparing original vs edited |
| `lib/types.ts` | Add `EditingRecipe` interface with adjustment steps, over-editing warnings, improvement suggestions |
| `app/api/editing-recipe/route.ts` | POST endpoint — accepts two image uploads (original + edited), returns recipe |
| `app/editing/page.tsx` or `app/critique/page.tsx` | New "Editing Lab" tab/page — dual upload UI, side-by-side display, step-by-step recipe |
| Optional: collection | Persist recipes for history |

### Output Schema
```json
{
  "adjustmentsDetected": [
    { "slider": "Exposure", "direction": "increased", "estimatedAmount": "+0.5 EV", "assessment": "appropriate" },
    { "slider": "Saturation", "direction": "increased", "estimatedAmount": "+30", "assessment": "overdone" },
    { "slider": "Shadows", "direction": "increased", "estimatedAmount": "+25", "assessment": "appropriate" }
  ],
  "overEditingWarnings": [
    "Saturation is pushed too high — skin tones appear orange. Pull back to +10-15."
  ],
  "suggestedImprovements": [
    { "slider": "Highlights", "value": "-15", "reason": "Recover detail in bright sky areas" },
    { "slider": "Clarity", "value": "+10", "reason": "Add mid-tone contrast for texture definition" }
  ],
  "editingApproach": "Warm, contrasty editorial look with lifted blacks",
  "overallAssessment": "Good direction. The warm tone suits the golden hour scene. Pulling back saturation and recovering highlights will make this look professional.",
  "difficultyLevel": "beginner-friendly"
}
```

### Acceptance Criteria
- [ ] User can upload two images (original + edited) on the editing page
- [ ] AI compares both and returns structured recipe within 15 seconds
- [ ] UI shows side-by-side comparison of both photos
- [ ] Adjustments listed as slider-by-slider instructions
- [ ] Over-editing warnings are clear and actionable
- [ ] Recipe adapts language to user's skill level

---

## Phase 8 — Visual Skill Tree & XP System

> **prompt.md reference:** Section 2.1
> **Effort:** Medium-Large (3-4 sessions)
> **Premium impact:** VERY HIGH

### What It Does
Gamified skill progression system with visual tree map:

**Skill Categories (initial set — expandable):**
- Technical Skills (15 nodes): Exposure triangle, manual focus, flash basics, long exposure, HDR, white balance, metering modes, ISO management, depth of field, back-button focus, bracketing, panning, high-speed sync, focus stacking, tethered shooting
- Composition Skills (12 nodes): Rule of thirds, leading lines, framing, symmetry, negative space, foreground interest, depth layering, golden ratio, diagonal composition, minimalism, pattern/repetition, breaking rules
- Post-Processing Skills (8 nodes): Raw editing basics, exposure correction, color grading, cropping/straightening, sharpening, noise reduction, local adjustments, batch editing

**XP Sources:**
- Complete a challenge: +50-200 XP (scaled by difficulty)
- Submit a photo: +25 XP
- Receive critique score > 70: +50 XP per dimension above threshold
- Maintain streak: +10 XP per day
- Complete story-driven challenge: +300 XP
- Complete technical mastery level: +150 XP per level

**Progression Mechanics:**
- Skills start locked (grayed out)
- Prerequisite system (must unlock "Exposure Triangle" before "Manual Flash")
- Each skill has 3 tiers: Learned (100 XP) → Practiced (500 XP) → Mastered (2000 XP)
- Visual tree map with connecting lines showing prerequisites
- Total XP and level displayed in navbar/profile

### Why This Feature
- Gamification is the #1 proven retention mechanic in education apps
- Currently progress is flat numbers (total completed, streak). A skill tree gives users a *visible path* and *reason to keep coming back*
- Every challenge completion and critique naturally feeds XP — ties all features together
- This is what turns a tool into a platform that users subscribe to monthly
- Phases 4-7 all generate data that feeds into skill progression

### Technical Plan

| Component | Change |
|-----------|--------|
| `lib/appwrite-collections.ts` | Add `COLLECTION_SKILL_DEFINITIONS`, `COLLECTION_USER_SKILLS` |
| `scripts/appwrite-setup.ts` | Create skill_definitions (static skill data) and user_skills (per-user progress) collections |
| `lib/types.ts` | Add `SkillNode`, `UserSkill`, `SkillCategory`, `XPEvent` interfaces |
| `lib/skills.ts` | New module — skill tree data (nodes, prerequisites, XP thresholds), XP calculation functions |
| `app/api/skills/route.ts` | GET user's skill tree state, POST to award XP |
| `app/api/skills/tree/route.ts` | GET full skill tree definition with user's unlock state |
| `app/skills/page.tsx` | Visual skill tree page — interactive node map with category tabs, progress indicators, XP bar |
| `hooks/use-dashboard-data.ts` | Add `useSkillTree()`, `useUserXP()` hooks |
| `app/api/submissions/route.ts` | Add XP award on challenge completion (hook into existing flow) |
| `app/api/critiques/route.ts` | Add XP award on critique score thresholds (hook into existing flow) |
| Navbar | Add XP/level indicator |

### Skill Tree Data Structure
```typescript
interface SkillNode {
  id: string;                    // "exposure_triangle"
  name: string;                  // "Exposure Triangle"
  category: "technical" | "composition" | "post_processing";
  description: string;           // What this skill covers
  prerequisites: string[];       // IDs of required skills
  xpToLearn: number;            // 100
  xpToPractice: number;         // 500
  xpToMaster: number;           // 2000
  tier: 1 | 2 | 3;             // Difficulty tier within category
  icon: string;                  // Lucide icon name
  relatedChallengeCategories: string[]; // Which challenge types earn XP for this skill
}

interface UserSkill {
  userId: string;
  skillId: string;
  currentXP: number;
  status: "locked" | "learned" | "practiced" | "mastered";
  lastXPDate: string;
}
```

### Acceptance Criteria
- [ ] Skill tree page renders with all nodes in correct categories
- [ ] Locked skills are visually distinct from unlocked
- [ ] Prerequisite connections shown as lines between nodes
- [ ] Completing a challenge awards XP to relevant skills
- [ ] Critique scores above threshold award bonus XP
- [ ] Skill status updates when XP threshold reached
- [ ] User's total XP and level shown in navbar
- [ ] Skill tree state persists across sessions

---

## Phase 9 — Portfolio Intelligence (Curation AI)

> **prompt.md reference:** Section 6.1
> **Effort:** Medium (2 sessions)
> **Premium impact:** MEDIUM-HIGH

### What It Does
User uploads 10-20 photos and gets portfolio curation intelligence:

- **Best Selection:** AI picks the strongest 8-12 for a portfolio, with reasoning
- **Consistency Audit:** "Your editing style varies 35% across these shots — tighten warm tone and contrast levels"
- **Gap Analysis:** "Strong portraits, lacking environmental/landscape context shots"
- **Sequencing:** Recommended order for maximum impact (hook → variety → strong closer)
- **Style Summary:** "Your emerging style: warm tones, shallow depth of field, candid moments"

### Why This Feature
- Every photographer building a portfolio needs outside curation perspective
- Batch vision analysis — multiple `critiquePhoto()` style calls + a meta-summary pass
- Feels very premium — no free tool does this
- "Consistency audit" and "gap analysis" are outputs unique to an AI coach
- Natural progression: users accumulate critiqued photos over time, then curate them into a portfolio

### Technical Plan

| Component | Change |
|-----------|--------|
| `lib/llm.ts` | Add `analyzePortfolio()` — multi-image vision analysis + summary pass |
| `lib/types.ts` | Add `PortfolioAnalysis` interface |
| `app/api/portfolio/route.ts` | POST endpoint — accepts multiple image uploads (max 20), returns curation analysis |
| `app/portfolio/page.tsx` | New page — multi-image upload, drag-to-reorder, analysis display with sections |
| Optional: collection | Persist portfolio analyses |

### Processing Strategy
```
1. Upload 10-20 images
2. For each image: quick vision assessment (score + style tags) — parallel calls, max 5 concurrent
3. Meta-analysis pass: compare all assessments for consistency, gaps, strengths
4. Curation pass: select best subset, generate sequence, produce final report
5. Total: (N + 2) LLM calls where N = number of images
6. Rate limit: max 20 images per analysis, max 3 analyses per day per user
```

### Acceptance Criteria
- [ ] User can upload 10-20 photos in bulk
- [ ] AI analyses complete within 60 seconds (parallel processing)
- [ ] Best selection includes reasoning for each included/excluded photo
- [ ] Consistency audit identifies specific style variations
- [ ] Gap analysis suggests missing shot types
- [ ] Sequencing provides ordered layout with rationale
- [ ] Rate limiting prevents API cost overruns
- [ ] UI handles long processing time gracefully (progress indicator)

---

## Phase Dependency Graph

```
Phase 4 (Recreate)     Phase 5 (Challenges)    Phase 6 (Insights)
     |                       |                        |
     |                       |                        |
     v                       v                        v
Phase 7 (Editing)     [all feed XP into]        [data feeds into]
     |                       |                        |
     +-------+-------+------+--------+-------+-------+
             |                        |
             v                        v
        Phase 8 (Skill Tree)    Phase 9 (Portfolio)
```

Phases 4, 5, 6 are fully independent — can be built in any order or in parallel.
Phase 7 shares UI patterns with Phase 4 (dual image upload).
Phase 8 depends on all prior phases for XP sources.
Phase 9 depends on vision patterns from Phase 4.

---

## Cost & API Usage Estimates

| Feature | LLM Calls Per Use | Vision? | Estimated Cost Per Use |
|---------|-------------------|---------|----------------------|
| Recreate This | 1 | Yes | ~$0.01-0.03 |
| Enhanced Challenges | 1 | No | ~$0.002 |
| Weekly Insights | 1 | No | ~$0.003 |
| Editing Recipe | 1 (2 images) | Yes | ~$0.02-0.04 |
| Skill Tree XP | 0 (calculation only) | No | $0 |
| Portfolio Curation | 12-22 | Yes | ~$0.15-0.40 |

Portfolio curation is the most expensive — rate limiting is essential.
