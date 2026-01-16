"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { getAnime } from "@/components/ui-preferences/anime";
import { useUiPreferences } from "@/components/ui-preferences/ui-preferences-provider";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function AnimeTopLoader() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const { preferences } = useUiPreferences();

  React.useEffect(() => {
    if (!preferences.enableAnimeJs) return;
    if (prefersReducedMotion()) return;

    const el = ref.current;
    if (!el) return;

    const preset = preferences.animationPreset;
    let cancelled = false;

    void getAnime().then((anime) => {
      if (cancelled) return;
      if (!anime) return;

      anime.remove(el);
      anime.set(el, {
        opacity: 1,
        scaleX: 0,
        transformOrigin: "0% 50%",
      });

      const easing = preset === "show" ? anime.eases.outExpo : anime.eases.outQuad;

      const tl = anime.createTimeline({
        autoplay: true,
      });

      tl.add(
        el,
        {
          scaleX: [0, 1],
          duration: preset === "show" ? 650 : 380,
          easing,
        },
        0
      );

      tl.add(
        el,
        {
          opacity: [1, 0],
          duration: preset === "show" ? 520 : 320,
          easing,
        },
        preset === "show" ? 520 : 320
      );
    }).catch(() => {
      // fail-safe: ignore AnimeJS failures
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, preferences.enableAnimeJs, preferences.animationPreset]);

  if (!preferences.enableAnimeJs) return null;

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[60] h-[2px] w-full">
      <div
        ref={ref}
        className="h-full w-full bg-gradient-to-r from-primary via-accent to-primary"
      />
    </div>
  );
}
