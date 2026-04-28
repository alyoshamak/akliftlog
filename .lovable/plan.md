## Add a "Wild" retro arcade theme

Add a 4th theme option alongside Dark, Light, and Auto. "Wild" will look like an old-school video game — neon colors, deep purple/black background, hot pink + cyan + electric yellow accents, glowing buttons. It will be fully isolated so toggling between the existing modes continues to work exactly as before.

### What the user sees
- Profile → Theme now shows four pills: **Dark · Light · Auto · Wild**
- Picking Wild instantly transforms the app to a vibrant arcade look
- Picking any other option restores that mode cleanly with no leftover Wild styling

### Visual direction for "Wild"
- Background: deep midnight purple (almost black)
- Surfaces: dark indigo with glowing borders
- Primary accent: hot magenta/pink
- Secondary accent: electric cyan
- Highlight: arcade yellow
- Slightly stronger shadows / glow on cards and buttons
- Same Inter font (no font swap, keeps layout stable)

### Technical changes (small, contained)

1. **`src/index.css`** — add a new `.wild` class block right after `.dark`, defining the same set of design tokens (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--accent`, `--border`, `--surface-1/2/3`, `--shadow-card`, `--shadow-glow`, `--gradient-accent`, etc.) with neon HSL values. No changes to `:root` or `.dark`.

2. **`src/hooks/useProfile.ts`** — extend the `theme` union type from `"dark" | "light" | "system"` to `"dark" | "light" | "system" | "wild"`. No DB migration needed (column is plain `text`).

3. **`src/pages/Profile.tsx`** — 
   - Add `"wild","Wild"` to the Theme `Toggles` options (grid already uses `grid-cols-3` — switch to `grid-cols-2` so 4 pills wrap nicely on mobile, or keep `grid-cols-3` with the 4th wrapping; we'll use `grid-cols-2` for a clean 2×2 on mobile).
   - Update `setTheme` so it always clears both `dark` and `wild` classes from `documentElement` first, then applies the correct one:
     - `wild` → add `.wild`
     - `dark` → add `.dark`
     - `light` → no class
     - `system` → add `.dark` if OS prefers dark, else nothing
   - This guarantees switching between any two modes never leaves residue.

4. **App startup** — currently the theme class is only applied when the user toggles it on the Profile page (no boot-time logic exists). To make Wild persist across reloads, add a tiny effect in `src/pages/Profile.tsx`'s `useProfile` consumer path — specifically, apply the saved theme once when `profile` first loads (same logic as `setTheme`). This also fixes the existing reload behavior for Dark/Light/Auto without changing their semantics.

### Safety / non-regression
- `.dark` block is untouched → Dark mode unchanged.
- `:root` (Light) is untouched → Light mode unchanged.
- Auto still resolves via `prefers-color-scheme` → unchanged.
- Class-clearing step ensures no mode "sticks" when switching.
- DB schema unchanged; only the TypeScript union widens.

### Files touched
- `src/index.css` (add `.wild` block)
- `src/hooks/useProfile.ts` (widen type)
- `src/pages/Profile.tsx` (add option, robust setTheme, apply-on-load)
