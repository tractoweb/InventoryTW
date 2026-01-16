"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { getAnime } from "@/components/ui-preferences/anime";
import { useUiPreferences } from "@/components/ui-preferences/ui-preferences-provider";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function AnimatedPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const { preferences } = useUiPreferences();

  React.useEffect(() => {
    if (!preferences.enableAnimeJs) return;
    if (prefersReducedMotion()) return;

    const el = ref.current;
    if (!el) return;

    const preset = preferences.animationPreset;

    void getAnime().then((anime) => {
      anime.remove(el);
      anime.animate(el, {
        opacity: [0, 1],
        translateY: preset === "show" ? [28, 0] : [12, 0],
        duration: preset === "show" ? 900 : 450,
        easing: preset === "show" ? anime.eases.outExpo : anime.eases.outQuad,
      });
    });
  }, [pathname, preferences.enableAnimeJs, preferences.animationPreset]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
