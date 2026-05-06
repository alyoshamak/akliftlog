## Plan: "Share your gainz with friends" on Home

Add a small, inviting share entry point to the Home screen that opens a bottom sheet with two flows: share profile or share a workout plan. Both ultimately copy a link to the clipboard and show a toast hint.

### 1. New component: `src/components/ShareGainzCard.tsx`

A compact, visually inviting card (not a giant CTA). Style:
- Subtle accent gradient/border with a `Share2` (or `Sparkles`) icon
- Single line: **"Share your gainz with friends"** + small chevron
- Sits below the existing Home grid, above the "workouts logged" footer
- Uses existing semantic tokens (`bg-accent/10`, `border-accent/30`, `text-accent`) — no oversized hero

Clicking opens a `Sheet` (bottom) with two big tap targets:
1. **Share your progress** — profile link (uses `getOrCreateProfileShare` + `profileShareUrl`)
2. **Share workout plans** — opens a second step

### 2. Plan selection step

Inside the same sheet, when "Share workout plans" is tapped:
- Fetch user's plans (`workout_plans` where `user_id = me`)
- If 0 plans → toast "Create a plan first" and close
- If 1 plan → skip selection, go straight to share
- If 2+ plans → render a vertical list of plan cards (name + description). Tap one to share

### 3. Copy + toast behavior

For both flows, use `copyToClipboardAsync` (iOS-safe) wrapping the link generation:
- Profile: `getOrCreateProfileShare(user.id)` → `profileShareUrl(slug)`
- Plan: reuse existing share if present (query `plan_shares` by `source_plan_id`, `revoked_at IS NULL`), else `createOrReplacePlanShare(...)` → `planShareUrl(slug)`

On success show a sonner toast:
- Title: **"Link copied!"**
- Description: **"Paste it into a message to share with your friends 💪"**

Close the sheet on success.

### 4. Wire into Home

Import `ShareGainzCard` in `src/pages/Home.tsx` and place it after the 2-column grid (`Pick a day` / `Free Workout`), before the "workouts logged" link.

### Technical notes

- Reuses existing helpers in `src/lib/share.ts` — no new SQL or RLS changes
- All-frontend change; no backend or schema modifications
- Sheet uses existing `@/components/ui/sheet` for consistency with the "Pick a day" sheet already on Home
- Component is self-contained; manages its own open state and step state (`'menu' | 'pickPlan'`)
