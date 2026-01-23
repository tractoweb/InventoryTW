"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { getUserUiPreferences } from "@/actions/get-user-ui-preferences";
import {
  DEFAULT_USER_UI_PREFERENCES,
  type UserUiPreferences,
} from "@/lib/ui-preferences";
import { getAnime } from "@/components/ui-preferences/anime";

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

  root.dataset.uiDecor = preferences.enableDecor ? "on" : "off";
  root.dataset.uiDecorStyle = preferences.decorStyle;

  const decorIntensity = clamp(Number(preferences.decorIntensity ?? 0.35), 0, 1);
  root.style.setProperty("--ui-decor-opacity", String(decorIntensity));

  if (preferences.decorAccentHex) {
    const hsl = hexToHslString(preferences.decorAccentHex);
    if (hsl) root.style.setProperty("--ui-decor-accent", hsl);
  }

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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
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

  React.useEffect(() => {
    // Ensure the global theme matches the logged-in user's preference.
    // This avoids leaking a previous user's theme into the login page.
    if (!preferences?.theme) return;
    setTheme(preferences.theme);
  }, [preferences?.theme, setTheme]);

  React.useEffect(() => {
    if (!preferences.enableAnimeJs) return;
    if (prefersReducedMotion()) return;

    const abort = new AbortController();
    const signal = abort.signal;

    const active = new WeakSet<HTMLElement>();

    const animateIn = async (el: HTMLElement) => {
      const anime = await getAnime();
      if (signal.aborted) return;
      if (!anime) return;

      active.add(el);
      anime.remove(el);
      anime.animate(el, {
        translateY: preferences.animationPreset === "show" ? -2 : -1,
        scale: preferences.animationPreset === "show" ? 1.03 : 1.02,
        duration: preferences.animationPreset === "show" ? 220 : 160,
        easing: preferences.animationPreset === "show" ? anime.eases.outExpo : anime.eases.outQuad,
      });
    };

    const animateOut = async (el: HTMLElement) => {
      const anime = await getAnime();
      if (signal.aborted) return;
      if (!anime) return;

      active.delete(el);
      anime.remove(el);
      anime.animate(el, {
        translateY: 0,
        scale: 1,
        duration: preferences.animationPreset === "show" ? 280 : 180,
        easing: preferences.animationPreset === "show" ? anime.eases.outExpo : anime.eases.outQuad,
      });
    };

    const findTarget = (evtTarget: EventTarget | null): HTMLElement | null => {
      const node = evtTarget as Element | null;
      if (!node?.closest) return null;
      const el = node.closest("[data-anime-hover=lift]") as HTMLElement | null;
      if (!el) return null;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return null;
      return el;
    };

    const onPointerOver = (e: PointerEvent) => {
      const el = findTarget(e.target);
      if (!el) return;
      if (active.has(el)) return;
      void animateIn(el);
    };

    const onPointerOut = (e: PointerEvent) => {
      const el = findTarget(e.target);
      if (!el) return;
      // If moving within the same element, ignore.
      const related = e.relatedTarget as Node | null;
      if (related && el.contains(related)) return;
      void animateOut(el);
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = findTarget(e.target);
      if (!el) return;
      if (active.has(el)) return;
      void animateIn(el);
    };

    const onFocusOut = (e: FocusEvent) => {
      const el = findTarget(e.target);
      if (!el) return;
      void animateOut(el);
    };

    document.addEventListener("pointerover", onPointerOver, { signal });
    document.addEventListener("pointerout", onPointerOut, { signal });
    document.addEventListener("focusin", onFocusIn, { signal });
    document.addEventListener("focusout", onFocusOut, { signal });

    return () => {
      abort.abort();
    };
  }, [preferences.enableAnimeJs, preferences.animationPreset]);

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
