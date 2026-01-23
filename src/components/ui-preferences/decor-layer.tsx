"use client";

import * as React from "react";

import { useUiPreferences } from "@/components/ui-preferences/ui-preferences-provider";
import { getAnime } from "@/components/ui-preferences/anime";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function seeded(n: number) {
  // deterministic pseudo-random [0, 1)
  const x = Math.sin(n * 999) * 10000;
  return x - Math.floor(x);
}

export function DecorLayer() {
  const { preferences } = useUiPreferences();

  const enabled = Boolean(preferences.enableDecor);
  const style = preferences.decorStyle ?? "floral";
  const intensity = Math.max(0, Math.min(1, Number(preferences.decorIntensity ?? 0.35)));
  const animate = enabled && Boolean(preferences.enableAnimeJs) && !prefersReducedMotion();

  const items = React.useMemo(() => {
    const count = style === "emoji" ? 14 : 10;
    return Array.from({ length: count }, (_, i) => {
      const x = Math.round(seeded(i + 1) * 100);
      const y = Math.round(seeded(i + 11) * 100);
      const s = 0.75 + seeded(i + 21) * 1.1;
      const r = -18 + seeded(i + 31) * 36;
      return { id: i, x, y, s, r };
    });
  }, [style]);

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!animate) return;

    const abort = new AbortController();

    async function run() {
      const el = containerRef.current;
      if (!el) return;

      const anime = await getAnime();
      if (abort.signal.aborted) return;
      if (!anime) return;

      const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-decor-item]"));
      for (const node of nodes) anime.remove(node);

      for (const node of nodes) {
        const idx = Number(node.dataset.decorIndex ?? 0);
        const drift = 8 + seeded(idx + 101) * 14;
        const dur = 6200 + seeded(idx + 201) * 3200;
        const delay = seeded(idx + 301) * 800;

        anime.animate(node, {
          translateY: [0, -drift, 0],
          rotate: [Number(node.dataset.decorRotate ?? 0), Number(node.dataset.decorRotate ?? 0) + 6, Number(node.dataset.decorRotate ?? 0)],
          duration: dur,
          delay,
          loop: true,
          easing: anime.eases.inOutSine,
        });
      }
    }

    void run();

    return () => abort.abort();
  }, [animate]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        opacity: Math.max(0.02, Math.min(0.25, intensity * 0.25)),
      }}
    >
      {/* Soft repeated background pattern (handled in CSS too); this adds a second, more organic layer. */}
      {items.map((it) => {
        const commonStyle: React.CSSProperties = {
          position: "absolute",
          left: `${it.x}%`,
          top: `${it.y}%`,
          transform: `translate(-50%, -50%) scale(${it.s}) rotate(${it.r}deg)`,
          transformOrigin: "center",
          filter: "blur(0.15px)",
        };

        if (style === "emoji") {
          return (
            <div
              key={it.id}
              data-decor-item
              data-decor-index={it.id}
              data-decor-rotate={it.r}
              style={commonStyle}
              className="select-none"
            >
              <span style={{ fontSize: 42, opacity: 0.9 }}>🌼</span>
            </div>
          );
        }

        // floral/stickers: draw a simple "flower" using gradients (no external assets).
        return (
          <div
            key={it.id}
            data-decor-item
            data-decor-index={it.id}
            data-decor-rotate={it.r}
            style={commonStyle}
            className="h-16 w-16 rounded-full"
          >
            <div
              className="h-full w-full rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, hsl(var(--ui-decor-accent) / 0.95) 0 14%, transparent 15%)," +
                  "radial-gradient(circle at 35% 30%, hsl(var(--ui-decor-accent) / 0.55) 0 22%, transparent 23%)," +
                  "radial-gradient(circle at 65% 30%, hsl(var(--ui-decor-accent) / 0.55) 0 22%, transparent 23%)," +
                  "radial-gradient(circle at 30% 62%, hsl(var(--ui-decor-accent) / 0.55) 0 22%, transparent 23%)," +
                  "radial-gradient(circle at 70% 62%, hsl(var(--ui-decor-accent) / 0.55) 0 22%, transparent 23%)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
