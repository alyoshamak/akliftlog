## Goal

Let users step away from a workout without losing it. Leaving the workout opens a dialog asking whether to **Pause** (keep it running) or **Cancel** (discard it). When a workout is paused, a persistent **Resume / Cancel** banner appears on every other screen so they can jump back in.

## How it will work

### 1. Leaving a workout

Today the top-left button on the workout screen is labeled "Cancel" and immediately discards the workout (after a confirm). We'll change that exit path so it opens a clear two-choice dialog:

```text
┌───────────────────────────────────────┐
│  Leave this workout?                  │
│                                       │
│  Pause it so you can come back, or    │
│  cancel and discard your progress.    │
│                                       │
│  [ Pause workout ]  ← primary         │
│  [ Cancel workout ]  ← destructive    │
│  [ Keep training ]   ← dismiss        │
└───────────────────────────────────────┘
```

- **Pause workout** → just navigates to Home. Nothing is deleted; the `workout_sessions` row stays open (no `finished_at`), so all logged sets are preserved.
- **Cancel workout** → deletes the session and its sets (current behavior), then navigates Home.
- **Keep training** → closes the dialog.

The header label changes from "Cancel" to "Leave" to match the new behavior. Browser back / hardware back also triggers this same dialog.

### 2. Resume banner

A small banner appears at the top of the app on every screen **except** the active workout screen and the auth/onboarding screens, whenever the user has an unfinished `workout_sessions` row.

```text
┌─────────────────────────────────────────────────┐
│ ▶ Workout in progress · Day 3 · 12 min          │
│   [ Resume ]                          [ × ]     │
└─────────────────────────────────────────────────┘
```

- **Resume** → navigates back to `/session/{id}`.
- **×** → opens the same Cancel-workout confirmation (so users can ditch a forgotten paused session from anywhere).
- The banner shows the day name (or "Free workout") and how long ago it was started.

### 3. Edge cases handled

- If the user starts a new workout while one is already paused, we'll prompt: "You already have a workout in progress. Resume it or discard it first?" — prevents two open sessions at once.
- If multiple unfinished sessions somehow exist, the banner uses the most recent one.
- The banner re-checks for an active session on route changes and after auth state changes, so it appears/disappears correctly without a refresh.

## Technical details

- **No database changes.** `workout_sessions.finished_at IS NULL` is already the exact "paused / in progress" signal.
- **New hook `useActiveSession`** (`src/hooks/useActiveSession.ts`): subscribes once per signed-in user, queries the most recent unfinished session (with its `plan_day_id` → day name) and exposes `{ session, refresh, discard }`. Re-runs on route change.
- **New `LeaveWorkoutDialog`** component used by `Session.tsx`. Replaces the current `confirm()` in `cancelWorkout`. Wired to:
  - The header's left button (renamed to "Leave").
  - A `useBlocker`/`beforeunload` handler so browser back also opens it.
- **New `ResumeWorkoutBanner`** component rendered inside `AppShell` (above `<main>`). It uses `useActiveSession`, hides itself on `/session/*`, `/auth`, `/onboarding`. Adjusts the existing `pb-24` spacing so the banner doesn't overlap content (add a small top offset when visible).
- **Home `startDay` / `startFreeWorkout`** check `useActiveSession` first; if one exists, show a small dialog offering Resume or Discard before creating a new session.
- All copy uses existing semantic tokens (`bg-accent`, `text-muted-foreground`, `surface-card`, etc.) — no new colors.

## Files touched

- `src/hooks/useActiveSession.ts` (new)
- `src/components/ResumeWorkoutBanner.tsx` (new)
- `src/components/LeaveWorkoutDialog.tsx` (new)
- `src/components/AppShell.tsx` (render banner)
- `src/pages/Session.tsx` (swap confirm for dialog, rename button, block back-nav)
- `src/pages/Home.tsx` (guard against starting a 2nd session)

## Open question

One small choice worth your call before I build:

- **Banner position:** top of the screen (just under the status bar) **or** floating just above the bottom nav? Top is more visible; bottom keeps it out of the way of page headers. I'd recommend **top** — it matches how Spotify/Strava surface "in progress" sessions and is harder to miss.