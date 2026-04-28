## Goal

On the active workout screen, surface a subtle visual indicator on any exercise that already has at least one historical note — so the user remembers to peek at the last note before starting that exercise. No indicator at all on exercises without notes.

## Recommended UI pattern

A small **sticky-note icon pill next to the exercise name**, tappable as a shortcut to open the notes dialog directly.

```text
┌─────────────────────────────────────────────┐
│ A  Bench Press   [📝 3]              ⋯       │
│    Last: 135 lb × 8                          │
└─────────────────────────────────────────────┘
```

- Icon: `StickyNote` (already imported), in accent color so it pops against the muted "Last: …" line.
- Optional count badge (e.g. "3") so the user knows roughly how much history exists. If count feels noisy, we can drop it and show the icon only.
- Tapping the pill opens the existing `ExerciseNotesDialog` directly (same handler as the dropdown's "Add/View notes"), saving a tap vs. going through the ⋯ menu.
- Hidden entirely when the exercise has zero notes — keeps the row clean and makes the badge meaningful.

### Why this over alternatives

- **Dot on the ⋯ button**: discoverable only if you already look at the menu — defeats the "remind me" purpose.
- **Inline note text under the title**: takes vertical space on every exercise that has notes, competes with the "Last: …" line which is more actionable mid-set.
- **Toast/banner on session load**: too aggressive, easy to dismiss and forget.

The pill next to the name is glanceable, scoped to the right exercise, and doubles as a one-tap shortcut.

## Implementation outline (technical)

1. **Fetch note counts per exercise on session load** in `src/pages/Session.tsx`:
   - After `exercises` are loaded, run one query:
     ```ts
     supabase
       .from("exercise_notes")
       .select("exercise_id")
       .eq("user_id", user.id)
       .in("exercise_id", exerciseIds)
     ```
   - Reduce into `Record<exercise_id, number>` and store as `noteCounts` state.
2. **Pass `noteCount` into `ExerciseCard`** alongside `last`.
3. **Render the pill** in the card header (between the title block and the ⋯ menu) only when `noteCount > 0`:
   ```tsx
   {noteCount > 0 && (
     <button
       onClick={onNotes}
       className="inline-flex items-center gap-1 rounded-full bg-accent/15 text-accent px-2 py-1 text-xs font-bold tap-44"
       aria-label={`${noteCount} note${noteCount > 1 ? "s" : ""}`}
     >
       <StickyNote className="h-3.5 w-3.5" />
       {noteCount}
     </button>
   )}
   ```
4. **Keep counts fresh**: when `ExerciseNotesDialog` closes, increment/refetch the count for that exercise so newly added notes immediately surface the badge (and deletes that empty history hide it).

## Open question

- Show a **count number** next to the icon, or **icon-only**? I'd default to count — it gives a sense of how much history is there without opening the dialog.
