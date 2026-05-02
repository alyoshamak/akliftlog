
# Shareable Profile & Plan Links

Add two share flows: a live public profile page and snapshot-based shared plan pages. Both are viewable without an account; copying a plan requires sign-in.

## 1. Database changes

Two new tables (RLS open for public SELECT, owner-only INSERT/DELETE), plus a `username` column on `profiles`.

```sql
-- Public username for profile share URLs (/u/:username)
ALTER TABLE profiles ADD COLUMN username text UNIQUE;

-- Profile share toggle (lets users enable/revoke their public profile)
CREATE TABLE profile_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,        -- short non-guessable id
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

-- Plan share snapshots (immutable copy of plan at share time)
CREATE TABLE plan_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,        -- short non-guessable id
  user_id uuid NOT NULL,            -- sharer (for "shared by")
  source_plan_id uuid,              -- original (nullable; survives plan delete)
  plan_name text NOT NULL,
  plan_description text,
  shared_by_name text NOT NULL,     -- denormalized at share time
  snapshot jsonb NOT NULL,          -- { days: [{ day_number, name, exercises: [{ name, muscle_group, target_sets, target_reps, superset_group, exercise_id }] }] }
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);
```

RLS:
- `profile_shares` & `plan_shares`: public can SELECT when `revoked_at IS NULL`; only owner can INSERT/UPDATE/DELETE their own rows.
- `profiles`: add a public SELECT policy scoped to columns needed by `/u/:slug` (display_name, username only — keep goal/unit/theme private). Implementation: keep current owner-only policy, and create a `public.get_public_profile(slug text)` SECURITY DEFINER function that returns only the safe columns. Same approach for body weights / sessions stats via `public.get_public_profile_stats(slug)`.

Slug generation: 10-char base62 random in app code; collisions retried.

## 2. Routes (public, outside RequireAuth)

```
/u/:slug          → PublicProfile
/p/:slug          → PublicPlan
```

`App.tsx` registers these BEFORE the `RequireAuth`-wrapped routes. They render a lightweight shell (no `BottomNav`) and work whether or not the viewer is signed in.

## 3. Public profile page (`/u/:slug`) — live data

Fetched via the `get_public_profile_stats` RPC (single round trip):
- Display name, avatar placeholder
- Member since (profile.created_at)
- Total finished workouts (count of workout_sessions with finished_at)
- Current streak (computed server-side from session dates)
- PRs: heaviest single set for Bench Press, Back Squat, Deadlift, Overhead Press, Barbell Row — matched by exercise name (case-insensitive). Returns `{ exercise, weight, unit, reps, date }`.
- Top 5 exercises by 30-day volume (sum of weight×reps across sets, grouped by exercise).
- Active plan summary: name, day count, list of `{ day_number, name, exercise_count }`.

Footer banner for unauthenticated viewers: "Track your own lifts and PRs — sign up for LiftLog" → `/auth`.

No copy actions. View-only.

## 4. Public plan page (`/p/:slug`) — snapshot

Reads `plan_shares` row and renders:
- Header: plan name, "{N} days · Shared by {shared_by_name}", description
- For each day: day name + numbered list of `{ exercise_name · target_sets × target_reps }`, with superset grouping shown via a small "Superset" label band (same visual language as the editor).
- Two "Copy to My Plans" buttons (top + bottom).

Copy flow:
- **Signed in**: insert new `workout_plans` row (source = `'custom'`, is_active = false) + `plan_days` + `plan_day_exercises`. Match each snapshot exercise to the user's library by `exercise_id` first, then by name (case-insensitive); if missing, insert into `exercises` as a custom user-owned exercise. Show a dialog: "Saved to your plans" with "Set as active" / "Just save" actions, then route to `/plan/edit?planId={new}`.
- **Signed out**: open a modal "Join LiftLog to save this plan" with Sign Up / Log In buttons. Both routes pass `?next=/p/{slug}?copy=1`. After auth, `Auth.tsx` redirects to `next`; `PublicPlan` reads `?copy=1` on mount and auto-runs the copy.

## 5. Share entry points

- **PlansHub** (`src/pages/PlansHub.tsx`): add a Share icon button on the active plan card and on each library plan card. Action calls `sharePlan(planId)`.
- **Plan editor** (`src/pages/Plan.tsx`): add Share button in the header next to the title.
- **Profile** (`src/pages/Profile.tsx`): add a "Share Profile" button. First tap creates a `profile_shares` row (and assigns `username` if empty, derived from display_name + 4 random chars). Subsequent taps copy the existing URL. Toast: "Link copied!" / "Plan link copied!"
- **Reshare a plan**: on plans that already have a share row, the share button shows a small menu: "Copy link" / "Update link with current version" (creates a new snapshot, replaces the old slug — old link returns 404). 

## 6. Shared Links management

New section inside `Profile.tsx` (collapsible "Shared Links · N"):
- Profile share row: shows public URL, "Copy" + "Stop sharing" (sets `revoked_at`).
- Each plan share row: plan name, created date, "Copy" + "Revoke".

Revoked links: public pages render a friendly "This link is no longer available" state.

## 7. Open Graph meta tags

Lovable hosting serves the SPA `index.html`, so true per-route OG tags require server rendering — outside the SPA model. Practical approach:
- Keep base OG defaults in `index.html` ("LiftLog — train smarter").
- Use `react-helmet-async` to swap `<title>` for the public pages so in-app/browser titles read "{Name}'s Workout Plan — LiftLog". Browser-side OG tag updates won't affect iMessage/WhatsApp previews — call this out.
- For richer link unfurls, a dedicated edge function (`og-share`) could later return server-rendered HTML at `/share/p/:slug` redirecting to `/p/:slug`. Mark as a follow-up; not in this pass unless requested.

## 8. Files

**New**
- `src/pages/PublicProfile.tsx`
- `src/pages/PublicPlan.tsx`
- `src/lib/share.ts` — `slugify`, `createPlanShare`, `createProfileShare`, `revokeShare`, `copyPlanFromSnapshot`
- `supabase/migrations/<ts>_share_links.sql` — tables + RLS + `get_public_profile_stats(slug)` RPC

**Edited**
- `src/App.tsx` — public routes
- `src/pages/PlansHub.tsx` — share button per plan
- `src/pages/Plan.tsx` — share button in header
- `src/pages/Profile.tsx` — Share Profile button + Shared Links manager
- `src/pages/Auth.tsx` — honor `?next=` redirect after sign-in/sign-up
- `src/components/AppShell.tsx` — accept a `public` prop for hiding nav on public pages (or use `hideNav`, which already exists)

## Out of scope (call out to user)
- Server-rendered OG tags for rich link previews (would need an edge function).
- Avatar uploads (no avatar field exists today; the public profile shows initials).
- Analytics on share link views.


---

## Implementation status: complete

- Migration applied: `username` on profiles, `profile_shares`, `plan_shares`, two SECURITY DEFINER public RPCs (`get_public_profile_stats`, `get_public_plan_share`).
- Public routes added: `/u/:slug` (live profile snapshot) and `/p/:slug` (immutable plan snapshot).
- Share entry points: `ShareButton` dropdown on PlansHub (active card + library cards) and Plan editor header; "Share Profile" button in Profile.
- Recipient flow: copy-to-library auto-runs after auth via `?next=/p/{slug}?copy=1`; "Set as active" prompt after copy.
- Shared Links manager added to Profile.
- Two SECURITY DEFINER warnings are intentional and recorded in security memory.

### Known limitations (not implemented)
- Per-route Open Graph tags (would need an edge function for server-rendered HTML to make iMessage/WhatsApp previews work).
- Avatar uploads (no avatar_url column exists today; profile shows initials).
