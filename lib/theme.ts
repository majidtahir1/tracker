/** Light/dark theme identity + pre-paint bootstrap. Pure — no React, no DOM at import time. */

export type Theme = "light" | "dark";

/** localStorage key holding the user's explicit choice. */
export const THEME_STORAGE_KEY = "theme";

/** Narrow an arbitrary stored string to a valid Theme, or null. */
export function resolveStoredTheme(raw: string | null): Theme | null {
  return raw === "light" || raw === "dark" ? raw : null;
}

/** The other theme. */
export function oppositeTheme(t: Theme): Theme {
  return t === "dark" ? "light" : "dark";
}

/**
 * Synchronous script injected into <head> so it runs before first paint.
 * Reads the stored choice and sets data-theme on <html>. No stored value
 * leaves the attribute unset, so the :root (light) defaults apply.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
