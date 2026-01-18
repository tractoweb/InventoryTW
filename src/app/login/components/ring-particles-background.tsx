"use client";

import * as React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOutSine(t: number) {
  // 0..1 -> 0..1
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RingParticlesBackgroundProps = {
  className?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  paused?: boolean;
};

type Particle = {
  col: number;
  row: number;
  angle: number;
  rowT: number; // [0..1]
  angleJitter: number;
  rowJitter: number;
  size: number;
  alpha: number;
  color: "navy" | "blue" | "red" | "green" | "yellow";
  phase: number;
};

const DEFAULT_COLOR: Particle["color"] = "navy";

const DEFAULT_SEED = 200;
const PARTICLE_COLS = 80;
const PARTICLE_ROWS = 25;
const PARTICLE_SIZE = 2;
const PARTICLE_MIN_ALPHA = 0.1;
const PARTICLE_MAX_ALPHA = 1.0;

function particleColor(col: number, rowT: number) {
  // Colorido pero consistente: el tono depende del ángulo (col)
  // y una ligera variación por fila.
  const base = (col / PARTICLE_COLS) * 360;
  const hue = (base + rowT * 18) % 360;
  return `hsl(${hue} 86% 45%)`;
}

function makeParticles(seed: number): Particle[] {
  // Distribución estilo Antigravity: columnas (ángulos) x filas (espesor)
  // Esto produce “rayos” radiales (no nube aleatoria).
  const rand = mulberry32(seed);
  const particles: Particle[] = [];

  for (let col = 0; col < PARTICLE_COLS; col++) {
    const baseAngle = (col / PARTICLE_COLS) * Math.PI * 2;
    // Jitter sutil por columna para evitar que se vea demasiado “perfecto”
    const colAngleJitter = (rand() - 0.5) * (Math.PI * 2 / PARTICLE_COLS) * 0.25;

    for (let row = 0; row < PARTICLE_ROWS; row++) {
      const rowT = PARTICLE_ROWS <= 1 ? 0.5 : row / (PARTICLE_ROWS - 1);

      particles.push({
        col,
        row,
        angle: baseAngle,
        rowT,
        angleJitter: colAngleJitter + (rand() - 0.5) * 0.003,
        rowJitter: (rand() - 0.5) * 0.02,
        size: PARTICLE_SIZE,
        alpha: lerp(PARTICLE_MIN_ALPHA, PARTICLE_MAX_ALPHA, rand()),
        color: DEFAULT_COLOR,
        phase: rand() * Math.PI * 2,
      });
    }
  }

  return particles;
}

export function RingParticlesBackground({ className, anchorRef, paused }: RingParticlesBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const pausedRef = React.useRef<boolean>(Boolean(paused));

  React.useEffect(() => {
    pausedRef.current = Boolean(paused);
    if (pausedRef.current && rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [paused]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let destroyed = false;

    const reduceMotion = prefersReducedMotion();

    let particles: Particle[] = [];

    let w = 0;
    let h = 0;
    let dpr = 1;

    let pointerX = 0.5;
    let pointerY = 0.5;

    let cx = 0;
    let cy = 0;

    let lastTs = performance.now();
    let tick = 0;

    const resize = () => {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles = makeParticles(DEFAULT_SEED);

      // Start centered (avoid a visible "jump" on first frames)
      cx = w * 0.5;
      cy = h * 0.5;
    };

    const onPointerMove = (e: PointerEvent) => {
      // El canvas cubre toda la pantalla; usar viewport asegura que “siga” el mouse siempre.
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      pointerX = clamp(e.clientX / vw, 0, 1);
      pointerY = clamp(e.clientY / vh, 0, 1);
    };

    const resetPointer = () => {
      pointerX = 0.5;
      pointerY = 0.5;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    resize();

    const draw = (ts: number) => {
      if (destroyed) return;
      if (pausedRef.current) return;

      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;

      if (!reduceMotion) tick += dt;

      // smooth follow pointer
      let baseCx = w * 0.5;
      let baseCy = h * 0.5;
      const anchorEl = anchorRef?.current;
      if (anchorEl) {
        const r = anchorEl.getBoundingClientRect();
        if (Number.isFinite(r.left) && Number.isFinite(r.top)) {
          baseCx = r.left + r.width / 2;
          baseCy = r.top + r.height / 2;
        }
      }

      const targetCx = baseCx + (pointerX - 0.5) * w * 0.12;
      const targetCy = baseCy + (pointerY - 0.5) * h * 0.12;
      cx += (targetCx - cx) * (reduceMotion ? 0.08 : 0.035);
      cy += (targetCy - cy) * (reduceMotion ? 0.08 : 0.035);

      // background
      ctx.clearRect(0, 0, w, h);

      // pure white so particles stay neutral/black
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(0, 0, w, h);

      // ring parameters
      const minSide = Math.min(w, h);
      // Aproximación a los parámetros del ejemplo:
      // --ring-radius animado ~150..250 y --ring-thickness ~600.
      const ringPeriod = 6;
      const ringPhase = (ts / 1000 / ringPeriod) % 2; // 0..2
      const ringT = ringPhase <= 1 ? ringPhase : 2 - ringPhase; // ping-pong 0..1

      const radiusMin = clamp(minSide * 0.2, 150, 240);
      const radiusMax = radiusMin + clamp(minSide * 0.11, 90, 150);
      const ringRadius = reduceMotion ? radiusMin : lerp(radiusMin, radiusMax, easeInOutSine(ringT));

      // Espesor grande como el ejemplo, pero se aplica hacia afuera (sin radios negativos)
      const thicknessPx = clamp(minSide * 0.75, 420, 700);

      // ripple 0..1 (equivalente a --animation-tick)
      const rippleT = (ts / 1000 / ringPeriod) % 1;

      // tiny dots on ring
      ctx.save();
      ctx.globalCompositeOperation = "source-over";

      for (const p of particles) {
        // “Rayos”: mismo ángulo por columna, variación radial por fila
        const angle = p.angle + p.angleJitter;
        // Interpretación tipo Antigravity: filas recorren el espesor hacia afuera
        const rowT = clamp(p.rowT + p.rowJitter, 0, 1);
        const localRadius = ringRadius + rowT * thicknessPx;

        const rx = cx + Math.cos(angle) * localRadius;
        const ry = cy + Math.sin(angle) * localRadius;

        // Fade hacia los bordes del espesor (más fuerte en el centro del band)
        const centered = Math.abs(rowT - 0.5) * 2;
        const thicknessAlpha = Math.pow(clamp(1 - centered, 0, 1), 1.25);

        // Ripple/twinkle suave
        const ripple = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin((rippleT * Math.PI * 2) + p.phase);
        const a = p.alpha * thicknessAlpha * ripple;
        if (a <= 0.01) continue;

        ctx.fillStyle = particleColor(p.col, rowT);
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(rx, ry, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // very subtle ring glow (como guía)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      if (!pausedRef.current) {
        rafRef.current = window.requestAnimationFrame(draw);
      }
    };

    if (!pausedRef.current) {
      rafRef.current = window.requestAnimationFrame(draw);
    }

    return () => {
      destroyed = true;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", resetPointer);
      ro.disconnect();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}
