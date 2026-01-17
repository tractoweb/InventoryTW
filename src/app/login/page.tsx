"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { getAnime } from "@/components/ui-preferences/anime";

import { loginAction } from "@/actions/auth/login";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import styles from "./login-animated.module.css";
import { RingParticlesBackground } from "./components/ring-particles-background";

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = React.useState("/");

  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const cardWrapRef = React.useRef<HTMLDivElement | null>(null);

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const n = params.get("next") || "/";
      setNext(n);
    } catch {
      setNext("/");
    }
  }, []);

  React.useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    let cancelled = false;

    void getAnime()
      .then((anime) => {
        if (cancelled) return;
        if (!anime) return;

        anime.animate(el, {
          opacity: [0, 1],
          translateY: [12, 0],
          scale: [0.985, 1],
          easing: "easeOutExpo",
          duration: 750,
        });

        anime.animate(el, {
          translateY: [0, -4],
          direction: "alternate",
          loop: true,
          easing: "easeInOutSine",
          duration: 2800,
          delay: 800,
        });
      })
      .catch(() => {
        // fail-safe
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginAction({ username, password });
      if (!res.success) {
        setError(res.error || "No se pudo iniciar sesión");
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div className={styles.root}>
      <RingParticlesBackground className={styles.bg} anchorRef={cardWrapRef} />

      <div className={styles.center}>
        <div className={styles.cardWrap} ref={cardWrapRef}>
          <Card ref={cardRef} className={styles.card}>
            <CardHeader>
              <CardTitle>Acceso</CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <form className="grid gap-4" onSubmit={onSubmit}>
                <div className="grid gap-2">
                  <Label>Usuario</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="usuario"
                    disabled={pending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Contraseña</Label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    disabled={pending}
                  />
                </div>
                <Button type="submit" disabled={pending || !username || !password}>
                  {pending ? "Ingresando…" : "Ingresar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
