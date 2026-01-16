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

    let cancelled = false;

    void getAnime().then((anime) => {
      if (cancelled) return;
      if (!anime) return;

      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-anime=card]"));
      const tabsLists = Array.from(
        el.querySelectorAll<HTMLElement>("[data-anime=tabs-list]")
      );

      const tables = Array.from(el.querySelectorAll<HTMLElement>("[data-anime=table]"));
      const tableRows = Array.from(el.querySelectorAll<HTMLElement>("[data-anime=table-row]"));
      const inputs = Array.from(el.querySelectorAll<HTMLElement>("[data-anime=input]"));
      const buttons = Array.from(el.querySelectorAll<HTMLElement>("[data-anime=button]"));

      const cappedRows = tableRows.slice(0, 20);
      const cappedInputs = inputs.slice(0, 10);
      const cappedButtons = buttons.slice(0, 12);

      const easing = preset === "show" ? anime.eases.outExpo : anime.eases.outQuad;

      anime.remove([
        el,
        ...cards,
        ...tabsLists,
        ...tables,
        ...cappedRows,
        ...cappedInputs,
        ...cappedButtons,
      ]);

      anime.set(el, {
        opacity: 0,
        translateY: preset === "show" ? 24 : 10,
      });

      if (tabsLists.length > 0) {
        anime.set(tabsLists, {
          opacity: 0,
          translateY: preset === "show" ? 14 : 8,
        });
      }

      if (cards.length > 0) {
        anime.set(cards, {
          opacity: 0,
          translateY: preset === "show" ? 26 : 12,
        });
      }

      if (tables.length > 0) {
        anime.set(tables, {
          opacity: 0,
          translateY: preset === "show" ? 18 : 10,
        });
      }

      if (cappedRows.length > 0) {
        anime.set(cappedRows, {
          opacity: 0,
          translateX: preset === "show" ? 16 : 10,
        });
      }

      if (cappedInputs.length > 0) {
        anime.set(cappedInputs, {
          opacity: 0,
          translateY: preset === "show" ? 12 : 8,
        });
      }

      if (cappedButtons.length > 0) {
        anime.set(cappedButtons, {
          opacity: 0,
          translateY: preset === "show" ? 12 : 8,
        });
      }

      const tl = anime.createTimeline({
        autoplay: true,
      });

      tl.add(
        el,
        {
          opacity: [0, 1],
          translateY: [preset === "show" ? 24 : 10, 0],
          duration: preset === "show" ? 900 : 450,
          easing,
        },
        0
      );

      if (tabsLists.length > 0) {
        tl.add(
          tabsLists,
          {
            opacity: [0, 1],
            translateY: [preset === "show" ? 14 : 8, 0],
            duration: preset === "show" ? 650 : 320,
            easing,
            delay: anime.stagger(preset === "show" ? 80 : 40),
          },
          preset === "show" ? 80 : 40
        );
      }

      if (cards.length > 0) {
        tl.add(
          cards,
          {
            opacity: [0, 1],
            translateY: [preset === "show" ? 26 : 12, 0],
            duration: preset === "show" ? 750 : 360,
            easing,
            delay: anime.stagger(preset === "show" ? 90 : 45),
          },
          preset === "show" ? 140 : 70
        );
      }

      if (tables.length > 0) {
        tl.add(
          tables,
          {
            opacity: [0, 1],
            translateY: [preset === "show" ? 18 : 10, 0],
            duration: preset === "show" ? 700 : 340,
            easing,
            delay: anime.stagger(preset === "show" ? 90 : 45),
          },
          preset === "show" ? 200 : 110
        );
      }

      if (cappedRows.length > 0) {
        tl.add(
          cappedRows,
          {
            opacity: [0, 1],
            translateX: [preset === "show" ? 16 : 10, 0],
            duration: preset === "show" ? 650 : 300,
            easing,
            delay: anime.stagger(preset === "show" ? 18 : 10),
          },
          preset === "show" ? 260 : 150
        );
      }

      if (cappedInputs.length > 0) {
        tl.add(
          cappedInputs,
          {
            opacity: [0, 1],
            translateY: [preset === "show" ? 12 : 8, 0],
            duration: preset === "show" ? 520 : 260,
            easing,
            delay: anime.stagger(preset === "show" ? 55 : 30),
          },
          preset === "show" ? 160 : 90
        );
      }

      if (cappedButtons.length > 0) {
        tl.add(
          cappedButtons,
          {
            opacity: [0, 1],
            translateY: [preset === "show" ? 12 : 8, 0],
            duration: preset === "show" ? 520 : 260,
            easing,
            delay: anime.stagger(preset === "show" ? 45 : 24),
          },
          preset === "show" ? 190 : 110
        );
      }
    }).catch(() => {
      // fail-safe: ignore AnimeJS failures
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, preferences.enableAnimeJs, preferences.animationPreset]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
