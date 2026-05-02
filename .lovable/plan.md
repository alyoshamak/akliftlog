
## Goal

Replace the current single-plan "Plan" tab (which dumps users straight into the editor) with a **Plans Hub** that supports multiple saved plans, switching the active plan, creating new plans through three flows, and a locked "Influencer Plans" tab teasing future curated plans.

The existing Plan editor (`/plan?planId=…`) stays exactly as it is — the hub just routes into it.

## Data model

The current schema already supports multiple plans per user (`workout_plans.user_id`, `workout_plans.is_active`). We add:

```sql
ALTER TABLE workout_plans
  ADD COLUMN description text,
  ADD COLUMN source text NOT NULL DEFAULT 'custom'
    CHECK (source IN ('custom','template','upload','influencer'));
```

- `description` — short label shown on cards (auto-set on template/upload/influencer creation, editable later in the editor).
- `source` — provenance label, used for a small chip on each plan card.

**Active-plan invariant**: enforced in app code (existing pattern). Setting a plan active runs:
```
UPDATE workout_plans SET is_active=false WHERE user_id=$me AND id<>$target;
UPDATE workout_plans SET is_active=true WHERE id=$target;
```

**Influencer plans**: NOT created in this iteration. The tab is locked with a "Coming soon" overlay. No `influencers` / `influencer_plans` tables yet — deferred until we actually populate them. This keeps scope tight and avoids dead schema.

## Routing

| Route | Purpose |
|---|---|
| `/plan` (was the editor) | **NEW**: Plans Hub (list + tabs) |
| `/plan/edit?planId=…` | The existing editor (renamed route) |
| `/plan/new` | Create-new-plan chooser (3 cards: Build / Template / Upload) |
| `/templates` | Existing — small change to accept `?planTarget=new` (always create a new plan instead of replacing active) |
| `/upload` | Existing — same change |

The `BottomNav` "Plan" entry continues to point at `/plan` and now lands on the hub.

Anywhere in the app that links to `/plan?planId=…&first=1` (Onboarding, Templates, Upload) is updated to `/plan/edit?planId=…&first=1`.

## Screens

### 1. Plans Hub — `src/pages/PlansHub.tsx`

Top of screen: tabs `My Plans` | `Influencer Plans` (using `Tabs` from shadcn).

**My Plans tab:**

- **Active Plan card** (highlighted with `ring-2 ring-accent`):
  - Plan name (large)
  - Day count + source chip (`Template`, `Upload`, `Influencer`, or none for Custom)
  - Description (if any), one line truncated
  - Primary button: **Edit** → `/plan/edit?planId=…`

- **My Plan Library** (collapsible section, default open if >1 plan, hidden if only the active plan exists):
  - Heading "My Plans" + count
  - One card per non-active plan:
    - Name, day count, source chip, description, "Updated {relative}" timestamp
    - Action row: **Set Active**, **Edit**, **Duplicate**, **Delete** (Delete uses `AlertDialog` confirm; blocked if it's the only plan with a confirmation that warns no plan will be active)

- **Create New Plan** button (full-width, prominent, accent color) → `/plan/new`

**Influencer Plans tab:**

- Single locked panel: lock icon, "Curated plans from coaches and athletes — coming soon." Greyed-out preview chips (e.g. mock cards with blur). No interactive content.

### 2. Create New Plan chooser — `src/pages/PlanNew.tsx`

Reuses the same three cards from Onboarding step 2 (extract into `src/components/PlanCreateOptions.tsx` so onboarding and this page share the markup):

1. **Start from a template** → `/templates?from=hub`
2. **Build from scratch** → creates an empty (non-active) plan and navigates to `/plan/edit?planId=…&first=1&askActive=1`
3. **Upload a plan** → `/upload?from=hub`

After Build / Template / Upload completes, the user lands in the editor. If `askActive=1` is in the URL **and** there's already another active plan, show a one-time `AlertDialog` on mount: "Set this as your active plan?" with **Set as Active** / **Save for Later**. Selecting Set Active flips `is_active`. Selecting Save for Later leaves the new plan inactive.

### 3. Editor (`/plan/edit`)

Same component as today's `Plan.tsx`, just moved to a new route path. Adjustments:

- Reads `planId` from query (already does)
- If `askActive=1` query param is present after creation, run the prompt described above on first render.
- Add a small **back-to-hub** breadcrumb at the top (`← Plans` instead of `← Home`).

### 4. Onboarding flow changes

- The "Build manually" button in onboarding currently inserts an active plan with `source='custom'` (default). Update to set `source='custom'` and `description='Custom plan'` defaults. No behavior change.
- Template and upload paths set `source='template'` / `source='upload'` and a sensible default `description` (e.g. template name's split style, or upload file name).

## Behaviors

**Setting a plan active** (Hub action):
1. `UPDATE workout_plans SET is_active=false WHERE user_id=$me`
2. `UPDATE workout_plans SET is_active=true WHERE id=$target`
3. Toast: "Active plan: {name}"
4. Refetch the hub list.

**Duplicate a plan**:
1. Insert a new `workout_plans` row with `name='{original} (Copy)'`, `is_active=false`, same `source` and `description`.
2. Fetch original `plan_days` + `plan_day_exercises`.
3. Insert copies under the new plan (new IDs, same day_number/name/exercise_id/position/sets/reps/superset_group).
4. Toast: "Duplicated."

**Delete a plan**:
- Confirm via `AlertDialog`.
- Cascade is **not** in the schema — explicitly delete child rows first (`plan_day_exercises` via day join, then `plan_days`, then the plan). The simplest version: query day IDs → delete `plan_day_exercises` where `day_id in (…)` → delete `plan_days` where `plan_id=…` → delete the plan.
- If deleting the active plan, do not auto-promote another — let the home screen show the "no active plan" state and prompt the user to pick one. Show a toast warning.

**Home screen** (`Home.tsx`):
- Already keys off `is_active = true`. No code change needed beyond updating any `/plan` links that meant "editor" to point at `/plan/edit`. The empty-state CTA "Set up my plan" now goes to `/plan` (the hub) which is the right place.

## Files

**New:**
- `src/pages/PlansHub.tsx` — the hub (tabs + active card + library + locked influencer tab)
- `src/pages/PlanNew.tsx` — the create-new chooser
- `src/components/PlanCreateOptions.tsx` — shared 3-card chooser used by hub and onboarding

**Edited:**
- `src/App.tsx` — change `/plan` to render `PlansHub`, add `/plan/edit` for the editor, add `/plan/new`
- `src/pages/Plan.tsx` — minor: route param compatibility, breadcrumb back to `/plan` instead of `/`, optional `askActive` prompt on first render
- `src/pages/Onboarding.tsx` — use shared `PlanCreateOptions`; set `source` + `description` on manual create
- `src/pages/Templates.tsx` — when not coming from onboarding, do **not** deactivate other plans; just create the new one and (if `from=hub`) navigate to editor with `askActive=1`. Set `source='template'`, `description=tpl.name`.
- `src/pages/Upload.tsx` — on successful parse-into-plan, set `source='upload'`, `description` from filename. If `from=hub`, do not auto-activate; route to editor with `askActive=1`.

**DB migration:**
- Add `description` and `source` columns to `workout_plans` (see SQL above). No RLS change needed (existing `plans_own` policy covers all operations).

**Not changed:**
- Editor internals (`Plan.tsx` body), `plan_days`, `plan_day_exercises`, `exercises`, RLS, edge functions.
- No influencer schema yet.

## Out of scope

- Real influencer plans data, admin tooling, or "Save to My Plans" flow (placeholder UI only with lock + "coming soon").
- Periodization or weekly progressions.
- Reordering plans manually in the library (sorted by `updated_at desc`).
- Sharing/exporting a plan.

## Validation

- After the migration, existing plans get `source='custom'`, `description=null` — fine.
- Setting active still satisfies the "exactly one active per user" expectation enforced at write time.
- `Home.tsx` continues to render the active plan; if the user deletes their active plan, Home gracefully falls through to the empty state and links to the hub.
- Editor route works whether reached from hub (Edit), create flows (with `?first=1&askActive=1`), or onboarding (existing flow).

