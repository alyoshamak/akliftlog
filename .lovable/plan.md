## Goal

In onboarding step 2, replace the current two-option screen with a **three-option** screen:
1. **Start from a template** (new, surfaced first)
2. **Build manually** (existing)
3. **Upload a plan** (existing)

The template path: pick from 5 pre-built splits → preview the full plan → confirm to load it into the editor.

## Templates (data only — no DB schema changes)

All 5 templates are defined as a static TypeScript file using exercise **names** that match the existing library (verified — all 77 built-in exercises cover everything needed; no new exercises required).

```
src/lib/planTemplates.ts
```

Each template:
```ts
{
  id: string;
  name: string;
  daysPerWeek: number;
  description: string;       // short "who it's for"
  dayFocus: string[];        // e.g. ["Push", "Pull", "Legs", "Push", "Pull", "Legs"]
  days: Array<{
    name: string;            // "Push A", "Upper Heavy", etc.
    exercises: Array<{ name: string; sets: number; reps: number }>;
  }>;
}
```

### Template content (concise — full sets/reps per exercise)

**1. Push / Pull / Legs (6 days/week)**
- Push A: Barbell Bench Press 4×6, Overhead Press 3×8, Incline Dumbbell Press 3×10, Lateral Raise 3×12, Tricep Pushdown 3×12, Overhead Tricep Extension 3×12
- Pull A: Pull-Up 4×8, Barbell Row 4×8, Lat Pulldown 3×10, Seated Cable Row 3×10, Face Pull 3×15, Barbell Curl 3×10
- Legs A: Back Squat 4×6, Romanian Deadlift 3×8, Leg Press 3×10, Leg Curl 3×12, Calf Raise 4×15
- Push B: Incline Barbell Bench Press 4×8, Seated Dumbbell Press 3×10, Dumbbell Bench Press 3×10, Cable Crossover 3×12, Skull Crusher 3×10, Tricep Pushdown 3×12
- Pull B: Deadlift 3×5, Lat Pulldown 4×10, Dumbbell Row 3×10, Straight Arm Pulldown 3×12, Hammer Curl 3×10, Incline Dumbbell Curl 3×12
- Legs B: Front Squat 4×8, Hip Thrust 3×10, Walking Lunge 3×10, Leg Extension 3×12, Leg Curl 3×12, Calf Raise 4×15

**2. Upper / Lower (4 days/week)**
- Upper Heavy: Barbell Bench Press 4×6, Barbell Row 4×6, Overhead Press 3×8, Lat Pulldown 3×10, Barbell Curl 3×10, Skull Crusher 3×10
- Lower Heavy: Back Squat 4×6, Romanian Deadlift 4×8, Leg Press 3×10, Leg Curl 3×10, Calf Raise 4×12, Plank 3×10
- Upper Light: Incline Dumbbell Press 4×10, Seated Cable Row 4×10, Lateral Raise 3×12, Face Pull 3×15, Hammer Curl 3×12, Tricep Pushdown 3×12
- Lower Light: Front Squat 3×10, Hip Thrust 3×10, Walking Lunge 3×10, Leg Extension 3×12, Calf Raise 4×15, Hanging Leg Raise 3×12

**3. Bro Split (5 days/week)**
- Chest: Barbell Bench Press 4×8, Incline Dumbbell Press 4×10, Machine Chest Press 3×10, Cable Crossover 3×12, Dumbbell Fly 3×12, Push-Up 3×15
- Back: Pull-Up 4×8, Barbell Row 4×8, Lat Pulldown 3×10, Seated Cable Row 3×10, Straight Arm Pulldown 3×12, Face Pull 3×15
- Shoulders: Overhead Press 4×8, Seated Dumbbell Press 3×10, Lateral Raise 4×12, Rear Delt Fly 3×12, Front Raise 3×12, Shrug 3×12
- Legs: Back Squat 4×8, Leg Press 4×10, Romanian Deadlift 3×10, Leg Curl 3×12, Leg Extension 3×12, Calf Raise 4×15
- Arms: Barbell Curl 4×10, Skull Crusher 4×10, Hammer Curl 3×12, Tricep Pushdown 3×12, Preacher Curl 3×12, Overhead Tricep Extension 3×12

**4. Full Body (3 days/week)**
- Day A: Back Squat 3×8, Barbell Bench Press 3×8, Barbell Row 3×8, Overhead Press 3×10, Plank 3×10
- Day B: Deadlift 3×5, Incline Dumbbell Press 3×10, Lat Pulldown 3×10, Lateral Raise 3×12, Hanging Leg Raise 3×12
- Day C: Front Squat 3×8, Dumbbell Bench Press 3×10, Seated Cable Row 3×10, Barbell Curl 3×10, Tricep Pushdown 3×12, Calf Raise 3×15

**5. PHUL — Power & Hypertrophy (4 days/week)**
- Upper Heavy: Barbell Bench Press 4×5, Barbell Row 4×5, Overhead Press 3×6, Pull-Up 3×6, Skull Crusher 3×8, Barbell Curl 3×8
- Lower Heavy: Back Squat 4×5, Deadlift 3×5, Leg Press 3×8, Leg Curl 3×8, Calf Raise 4×10
- Upper Hypertrophy: Incline Dumbbell Press 4×10, Seated Cable Row 4×10, Lateral Raise 3×12, Cable Crossover 3×12, Hammer Curl 3×12, Tricep Pushdown 3×12
- Lower Hypertrophy: Front Squat 3×10, Romanian Deadlift 3×10, Walking Lunge 3×10, Leg Extension 3×12, Leg Curl 3×12, Calf Raise 4×15

## UI flow

### 1. `src/pages/Onboarding.tsx` — step 2

Add a third card above the existing two:
- **"Start from a template"** (icon: LayoutGrid or Sparkles) → navigates to `/templates?from=onboarding`
- Existing **"Build manually"** and **"Upload a plan"** stay as-is

The "Build manually" handler today creates an empty active plan and sends user to `/plan?planId=…&first=1`. The template flow will use the same end-state but pre-populated.

### 2. New page: `src/pages/Templates.tsx` (route `/templates`)

A list view showing all 5 template cards. Each card displays:
- Template name (large, bold)
- Days/week badge ("6 days/week")
- 1-line description
- Day focus chips: e.g. `Push · Pull · Legs · Push · Pull · Legs`

Tapping a card opens a **preview** view (same page, second state, or modal sheet — using a dialog/sheet keeps the back nav clean):
- Shows each day name + collapsible exercise list (name + sets×reps)
- Sticky bottom bar with **"Use this template"** button + **"Cancel"**
- "Use this template" → loads it (see below) → navigates to `/plan?planId=…&first=1`

Header has a back button. If `?from=onboarding`, back returns to onboarding step 2.

### 3. Loading a template

When user confirms:
1. Deactivate any existing active plan for the user (`workout_plans.is_active = false`).
2. Insert a new `workout_plans` row with `name = template.name`, `is_active = true`.
3. For each template day (in order):
   - Insert a `plan_days` row.
   - For each exercise: look up `exercise_id` by exact name from `exercises` table (server-side query filtered to `owner_id is null`). Insert `plan_day_exercises` with `target_sets`, `target_reps`, `position`.
4. Mark profile `onboarded = true`.
5. Navigate to `/plan?planId={id}&first=1`.

If any template exercise name is missing from the library (shouldn't happen — verified — but defensive), skip it and continue, then toast a soft warning.

### 4. Entry points

- Primarily reached from onboarding step 2.
- Also reachable from the existing Plan editor as a future "Replace with template" affordance — **out of scope** for this change.

## Files

**New:**
- `src/lib/planTemplates.ts` — the 5 template definitions
- `src/pages/Templates.tsx` — list + preview UI + load handler

**Edited:**
- `src/pages/Onboarding.tsx` — add the third "Start from a template" card to step 2
- `src/App.tsx` — add `/templates` route (auth-gated, same as other onboarded pages)

**Not changed:**
- DB schema, RLS policies, exercise library, edge functions

## Validation

- Verified all exercises in the 5 templates exist in the `exercises` table with `owner_id is null` (queried 77 built-ins; all referenced names match).
- After loading, user lands in the existing Plan editor with the plan name and all days/exercises pre-filled, fully editable (rename, reorder, add/remove, change sets/reps, supersets) before any "save" — they're already saved as the active plan, but the editor persists edits live as today.

## Out of scope

- Saving custom user-made templates.
- Periodization (week-by-week progressions inside one plan).
- A "switch template" button inside the existing plan editor.
