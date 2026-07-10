"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  oppositeTheme,
  resolveStoredTheme,
  type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads the current theme from the DOM/storage — matches the pre-paint script. */
function readCurrentTheme(): Theme {
  if (typeof document !== "undefined") {
    const attr = resolveStoredTheme(document.documentElement.dataset.theme ?? null);
    if (attr) return attr;
  }
  if (typeof localStorage !== "undefined") {
    const stored = resolveStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
    if (stored) return stored;
  }
  return "light";
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR renders "light" (the default); the effect syncs to the real value on mount.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(readCurrentTheme());
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(oppositeTheme(readCurrentTheme()));
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
