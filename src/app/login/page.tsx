"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { loginAction } from "@/actions/auth/login";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = React.useState("/");

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
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">InventoryTW</p>
      </div>

      <Card>
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
  );
}
