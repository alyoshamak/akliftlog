
# LiftLog — Build Plan (Phase 1)

A mobile-first weightlifting tracker that opens to "Next Up," pre-fills weights from your last session, and stays out of your way between sets.

## Design direction (you picked "surprise me")

**Athletic minimalism, dark-first.** Heavy black/near-black surfaces with a single high-energy accent (electric lime `#D7FF3A`), big bold display numerals (Inter / Geist Mono for weights), oversized tap targets (56px+), generous whitespace, and snappy micro-interactions on set check-off (haptic-style scale + accent flash). Light mode supported but tuned for gym-screen glare. Default unit: **lbs**.

## Core experience

### 1. Auth & onboarding
- Email + password signup via Lovable Cloud (persistent sessions, ~30 days).
- First-run wizard:
  1. Pick a goal (Hypertrophy / Strength / Endurance — informational + influences nudge logic).
  2. Create your plan: **Manual** (pick number of days, add exercises per day with target sets × reps, drag to reorder), or **Upload** (PDF, image, spreadsheet, or text — AI parses → review/edit → save).
  3. Done → land on Home.

### 2. Home — "Next Up"
- Large card showing the next sequential workout day (based on last completed, not calendar).
- Secondary: "Pick a different day" sheet, and a "Free Workout" button.
- Bottom tab bar: Home · History · Progress · Plan · Profile.

### 3. Workout session (the hot path)
For each exercise in the day:
- Exercise name + last performance ("Last: 135 lb × 10, 10, 8 — 5 days ago").
- Pre-filled set rows (weight + reps) using **"match last + nudge if you hit all reps"**: if every target rep was hit last time, suggest +5 lb (compound) / +2.5 lb (isolation) or +1 rep depending on goal. Otherwise repeat last.
- One-tap **check** to log a set as suggested. Tap weight or reps to adjust with a fast numeric stepper (±5 / ±2.5 / keypad).
- Per-exercise actions: **Swap** (3 same-muscle-group recommendations + searchable catalog with fuzzy match), **Reorder** (drag handle), **Add exercise** (same picker), **Remove**.
- Sticky "Finish Workout" button at the bottom; saves session and updates Next Up.

### 4. Free workout
- Empty session. Tap "+ Add exercise" → catalog/search → log sets. Same data model as plan-based.

### 5. Exercise history
- Persistent search icon. Fuzzy search across the full catalog + user customs.
- Detail view: last performance (big), expandable list of last 10 sessions with date/weight/reps, line chart of top-set weight over time.

### 6. Plan editor
- Separate from in-session edits. Add/remove/reorder days, add/remove/reorder exercises per day, set target sets × reps. Changes apply only to future sessions.

### 7. Progress dashboard
- Per-exercise weight-over-time charts (Recharts).
- Workout frequency: which days you do most/least, skipped exercises.
- Consistency: 12-week heatmap + current streak.

### 8. Profile / settings
- Goal, units (lb/kg), theme (dark/light/system), logout.

## Exercise library
- Seeded library covering Chest / Back / Legs / Shoulders / Arms / Core (~80 exercises) with aliases for fuzzy matching ("OHP" → Overhead Press, "shrug" → Trap Shrug variants).
- Users can add custom exercises (saved per account, taggable to muscle groups).
- Fuzzy search via Fuse.js (token-based, alias-aware).

## AI plan upload
- Upload PDF / image / .xlsx / .csv / text.
- Backend edge function extracts text (pdf-parse, xlsx, OCR via vision model for images) and sends to Lovable AI Gateway (gemini-3-flash-preview) with a structured-output tool call returning `{ days: [{ name, exercises: [{ name, sets, reps }] }] }`.
- Each parsed exercise is matched to the library (fuzzy); unmatched ones are flagged for the user to confirm or create as custom.
- Review screen: edit anything before saving.

## PWA
- Web manifest (name, icon, standalone, theme color), basic service worker for app-shell caching. Install prompt on iOS/Android.

## Technical details

**Stack:** React + Vite + TypeScript + Tailwind + shadcn, React Router, Recharts, Fuse.js, dnd-kit (drag-and-drop), Lovable Cloud (Postgres + Auth + Storage + Edge Functions), Lovable AI Gateway.

**Schema (Postgres, all RLS-scoped to `auth.uid()`):**
- `profiles` — id, display_name, goal, unit_pref, theme
- `exercises` — id, name, muscle_group, aliases[], is_custom, owner_id (null for seed)
- `workout_plans` — id, user_id, name, created_at
- `plan_days` — id, plan_id, day_number, name
- `plan_day_exercises` — id, day_id, exercise_id, position, target_sets, target_reps
- `workout_sessions` — id, user_id, plan_day_id (nullable for free), started_at, finished_at
- `session_exercises` — id, session_id, exercise_id, position
- `session_sets` — id, session_exercise_id, set_number, weight_lb, reps, completed_at

**Edge functions:**
- `parse-plan-document` — accepts uploaded file, runs extraction + AI structured output, returns draft plan.
- `next-up` — computes next sequential day from last completed session.
- `last-performance` — for an exercise, returns most recent session_sets across all sessions.

**Suggestion rule (Phase 1):** for each exercise, fetch last session's sets; if `min(reps_done) >= target_reps` for every set, suggest `weight + 5 lb` (compounds: bench/squat/dead/row/OHP) or `weight + 2.5 lb` (isolations) — or `+1 rep` if goal is Endurance. Otherwise repeat last weight × target_reps.

**Storage:** Lovable Cloud Storage bucket `plan-uploads` (private, RLS by owner) for uploaded plan documents.

## Out of scope (Phase 2, per PRD)
Science-based periodization, AI workout builder, form videos, offline mode, rest timer, social, marketplace.

## Build order
1. Auth + profile + Lovable Cloud schema & RLS.
2. Exercise library seed + fuzzy search picker component.
3. Plan editor (manual creation).
4. Home + Next Up logic.
5. Workout session screen with set logging + suggestion engine.
6. Swap / reorder / add-exercise in-session.
7. Free workout flow.
8. Exercise history + per-exercise chart.
9. Progress dashboard.
10. AI plan upload (edge function + review UI).
11. PWA manifest + service worker + dark/light polish.
