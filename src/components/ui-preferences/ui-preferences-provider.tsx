"use client";

import * as React from "react";

import { getUserUiPreferences } from "@/actions/get-user-ui-preferences";
import {
  DEFAULT_USER_UI_PREFERENCES,
  type UserUiPreferences,
} from "@/lib/ui-preferences";

type UiPreferencesContextValue = {
  preferences: UserUiPreferences;
  setPreferences: (next: UserUiPreferences) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UiPreferencesContext = React.createContext<UiPreferencesContextValue | null>(null);

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToHslString(hex: string): string | null {
  const normalized = hex.trim();
  const m = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (!m) return null;

  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h = h / 6;
  }

  const hh = Math.round(h * 360);
  const ss = Math.round(s * 100);
  const ll = Math.round(l * 100);
  return `${hh} ${ss}% ${ll}%`;
}

function applyUiPreferencesToDom(preferences: UserUiPreferences) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.dataset.uiAnimejs = preferences.enableAnimeJs ? "on" : "off";
  root.dataset.uiAnimationPreset = preferences.animationPreset;

  const baseFontPx = 16;
  const fontScale = clamp(Number(preferences.fontScale ?? 1), 0.85, 1.25);
  root.style.fontSize = `${Math.round(baseFontPx * fontScale)}px`;

  const radiusRem = clamp(Number(preferences.radiusRem ?? 0.5), 0, 2);
  root.style.setProperty("--radius", `${radiusRem}rem`);

  if (preferences.primaryColorHex) {
    const hsl = hexToHslString(preferences.primaryColorHex);
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--chart-1", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-ring", hsl);
    }
  }
}

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = React.useState<UserUiPreferences>(DEFAULT_USER_UI_PREFERENCES);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUserUiPreferences();
      if (res.data) setPreferences(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    applyUiPreferencesToDom(preferences);
  }, [preferences]);

  const value = React.useMemo<UiPreferencesContextValue>(
    () => ({ preferences, setPreferences, loading, refresh }),
    [preferences, loading, refresh]
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const ctx = React.useContext(UiPreferencesContext);
  if (!ctx) throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  return ctx;
}
