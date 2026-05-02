## Diagnosis

The upload flow technically works end-to-end, but the parser's input is broken for everything except plain text and images:

1. **PDFs are decoded with `await file.text()`** — for binary PDFs this yields compressed-stream gibberish. The model receives noise and falls back to its instructed default ("3 sets of 10 reps") which is why the result feels "made up rather than parsed."
2. **XLSX/XLS are also decoded with `file.text()`** — they're zip archives, so the model gets binary noise.
3. **The system prompt encourages fabrication.** It tells the model to default to 3×10 when unclear, with no instruction to refuse, return empty, or flag low confidence.
4. **No model fallback / no per-exercise confidence.** The user sees a confident-looking draft regardless of input quality.
5. **Custom exercises default to `muscle_group: "chest"`** — misleading once saved.
6. **No edge function logs of model output**, so failures are invisible to us.

## Goals (per user answers)

- Make **images** and **spreadsheets (XLSX/CSV)** rock-solid; PDFs handled via image-rendering fallback (covers both text + scanned).
- Keep `google/gemini-3-flash-preview`, but improve preprocessing + prompt.
- When sets/reps are missing, fill defaults from the user's `goal` (strength → 5×5, hypertrophy → 3×10, endurance → 3×15) and surface this clearly.
- Keep the existing review-then-save UI; add a banner + per-exercise indicators when confidence is low or defaults were applied.

## Plan

### 1. Backend — rewrite `parse-plan-document` edge function

**A. Input handling per file type**
- **Images** (`image/*`): unchanged path (base64 → vision).
- **CSV / TXT / MD**: `file.text()` (correct), pass to model as text.
- **XLSX / XLS**: parse with the `xlsx` library (`https://esm.sh/xlsx@0.18.5`); convert each sheet to a CSV/markdown table and pass as structured text. Iterate every sheet (some plans split day-per-sheet).
- **PDF**: render every page to a PNG using `pdfjs-dist` + `canvas` (or simpler: `https://esm.sh/pdf-img-convert`) and send pages as image_url parts (cap at first ~6 pages to control cost). This handles both text-based and scanned PDFs uniformly.
- **Unknown**: try text; if result is mostly non-printable, return a clear error.

**B. New prompt + tool schema**
- System prompt rewritten to be strict:
  - "Extract ONLY exercises that are explicitly present in the document."
  - "If a value (sets or reps) is missing, set it to `null` — do NOT invent it."
  - "If the document does not contain a workout plan, return `days: []`."
  - "For each exercise, return a `confidence` field: `high` | `medium` | `low`."
- Tool schema gains: `confidence`, nullable `sets`/`reps`, optional `notes`, optional `superset_group`, optional `muscle_group_hint`.
- Pass the user's `goal` from the client → prompt context (only for tone, defaults applied client-side).

**C. Robustness**
- Log `aiJson.choices[0].message` for debugging.
- If `days` is empty, return `{ days: [], reason: "no_plan_detected" }` so the client can show a helpful message instead of an empty draft.
- Keep 429/402 surfacing.

### 2. Frontend — `src/pages/Upload.tsx`

- Pass `goal` (from `useProfile`) in the `invoke` body.
- After parse:
  - If `days.length === 0` → toast: "We couldn't find a workout plan in this file. Try a clearer image or paste the text." Don't enter draft mode.
  - Else, build draft and apply goal-based defaults for any `null` sets/reps:
    - `strength` → 5 sets × 5 reps
    - `hypertrophy` → 3 sets × 10 reps
    - `endurance` → 3 sets × 15 reps
  - Mark each exercise with `defaultsApplied: boolean` and pass `confidence` through.
- UI additions in the draft view:
  - Top banner: count of low-confidence + count of defaulted entries, e.g. *"3 exercises had no sets/reps in your file — we filled defaults based on your goal (hypertrophy)."*
  - Per-exercise badge: "auto-filled" (when defaults applied) or "low confidence" (yellow dot).
  - Keep all values editable as today.
- For unmatched exercises (no library hit), drop the misleading `muscle_group: "chest"` default — store as `"other"` and let the user fix it later in Plan editor.

### 3. Minor cleanup

- `parse-plan-document/index.ts`: add `Content-Type` to OPTIONS response, use `corsHeaders` from supabase-js if available.
- Add a small README comment at top of the function describing supported formats.
- No DB migrations needed.

## Files touched

- `supabase/functions/parse-plan-document/index.ts` — major rewrite (PDF→images, XLSX parsing, new prompt + schema, logging)
- `src/pages/Upload.tsx` — pass goal, apply defaults, empty-state, confidence badges, banner
- (No changes to DB, RLS, or other pages)

## Out of scope

- OCR libraries beyond what `pdf-img-convert` + the vision model already give us.
- Multi-week / mesocycle expansion (today the parser flattens to one week — flagging if user wants this we can layer later).
- Exercise-library auto-creation improvements (covered in a follow-up if desired).

## Validation

- Manually test with: a phone photo of a written plan, a CSV with day/exercise/sets/reps columns, an XLSX with one sheet per day, a text-based PDF, and a scanned PDF.
- Confirm: empty/garbage uploads now show the "no plan detected" toast instead of a fabricated draft.
- Check edge function logs for the `choices[0].message` dump after each test.
