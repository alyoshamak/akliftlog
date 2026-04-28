export type ThemeChoice = "dark" | "light" | "system" | "wild";

const STORAGE_KEY = "liftlog.theme";

export function applyTheme(t: ThemeChoice | string | null | undefined) {
  const root = document.documentElement;
  root.classList.remove("dark", "wild");
  if (t === "wild") {
    root.classList.add("wild");
  } else if (t === "dark") {
    root.classList.add("dark");
  } else if (t === "system") {
    if (matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
  }
  // "light" or unknown → no class (default :root)
  if (t === "dark" || t === "light" || t === "system" || t === "wild") {
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }
}

export function getStoredTheme(): ThemeChoice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system" || v === "wild") return v;
  } catch {}
  return null;
}

// Apply cached theme immediately on import so navigation/reload never flashes.
applyTheme(getStoredTheme() ?? "dark");
