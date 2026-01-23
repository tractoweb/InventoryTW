"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { updateUserUiPreferencesAction } from "@/actions/update-user-ui-preferences";
import {
  UserUiPreferencesSchema,
  type UserUiPreferences,
} from "@/lib/ui-preferences";
import { useToast } from "@/hooks/use-toast";
import { useUiPreferences } from "@/components/ui-preferences/ui-preferences-provider";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function UserUiPreferencesForm() {
  const { toast } = useToast();
  const { preferences, setPreferences, loading, refresh } = useUiPreferences();
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<UserUiPreferences>({
    resolver: zodResolver(UserUiPreferencesSchema),
    defaultValues: preferences,
  });

  React.useEffect(() => {
    form.reset(preferences);
  }, [preferences, form]);

  async function onSubmit(values: UserUiPreferences) {
    setError(null);
    const res = await updateUserUiPreferencesAction(values);
    if (!res.success || !res.data) {
      setError(res.error || "No se pudo guardar");
      return;
    }

    setPreferences(res.data);
    toast({
      title: "Preferencias guardadas",
      description: "Se aplicaron a tu sesión actual.",
    });

    // Best-effort sync from backend
    await refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalización (por usuario)</CardTitle>
        <CardDescription>
          Estas preferencias se guardan por usuario en <strong>ApplicationProperty</strong> y se cargan automáticamente
          al iniciar sesión.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form className="grid gap-6" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <Label className="text-base">Animaciones (AnimeJS)</Label>
                <p className="text-sm text-muted-foreground">
                  Librería de animaciones. Comando: <strong>npm i animejs</strong> (en este proyecto usamos pnpm).
                </p>
              </div>
              <Switch
                checked={Boolean(form.watch("enableAnimeJs"))}
                onCheckedChange={(v) => form.setValue("enableAnimeJs", Boolean(v))}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Preset</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.watch("animationPreset")}
                  onChange={(e) => form.setValue("animationPreset", e.target.value as any)}
                  disabled={loading}
                >
                  <option value="standard">Standard (sutil)</option>
                  <option value="show">Show (más visible)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  “Show” anima más fuerte la entrada de pantallas y widgets.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Color primario (UI)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={form.watch("primaryColorHex") ?? "#4f46e5"}
                    onChange={(e) => form.setValue("primaryColorHex", e.target.value)}
                    className="h-10 w-14 p-1"
                    disabled={loading}
                  />
                  <Input
                    value={form.watch("primaryColorHex") ?? ""}
                    onChange={(e) => form.setValue("primaryColorHex", e.target.value || null)}
                    placeholder="#4f46e5"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Afecta botones, ring, charts y sidebar.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border p-4">
            <Label className="text-base">Diseño & Tipografía</Label>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Redondeo (radius)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[Number(form.watch("radiusRem") ?? 0.5)]}
                    min={0}
                    max={2}
                    step={0.05}
                    onValueChange={(v) => form.setValue("radiusRem", Number(v?.[0] ?? 0.5))}
                    disabled={loading}
                  />
                  <span className="w-16 text-right text-sm text-muted-foreground">
                    {Number(form.watch("radiusRem") ?? 0.5).toFixed(2)}rem
                  </span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Tamaño de letra (font scale)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[Number(form.watch("fontScale") ?? 1)]}
                    min={0.85}
                    max={1.25}
                    step={0.01}
                    onValueChange={(v) => form.setValue("fontScale", Number(v?.[0] ?? 1))}
                    disabled={loading}
                  />
                  <span className="w-16 text-right text-sm text-muted-foreground">
                    x{Number(form.watch("fontScale") ?? 1).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Nota: estas opciones ajustan variables CSS globales (sin romper el layout). Podemos ampliar a densidad,
              fuentes y estilos por módulo en la siguiente iteración.
            </p>
          </div>

          <div className="grid gap-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <Label className="text-base">Decoraciones (Flores / Stickers)</Label>
                <p className="text-sm text-muted-foreground">
                  Se aplica por capas (no altera el layout). Puedes activar/desactivar cuando quieras.
                </p>
              </div>
              <Switch
                checked={Boolean(form.watch("enableDecor"))}
                onCheckedChange={(v) => form.setValue("enableDecor", Boolean(v))}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Estilo</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.watch("decorStyle")}
                  onChange={(e) => form.setValue("decorStyle", e.target.value as any)}
                  disabled={loading || !form.watch("enableDecor")}
                >
                  <option value="floral">Floral (gradientes)</option>
                  <option value="emoji">Emoji (🌼)</option>
                  <option value="stickers">Stickers (suave)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  En modo oscuro también se adapta automáticamente.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Color acento (decor)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={form.watch("decorAccentHex") ?? "#F2C94C"}
                    onChange={(e) => form.setValue("decorAccentHex", e.target.value)}
                    className="h-10 w-14 p-1"
                    disabled={loading || !form.watch("enableDecor")}
                  />
                  <Input
                    value={form.watch("decorAccentHex") ?? ""}
                    onChange={(e) => form.setValue("decorAccentHex", e.target.value || null)}
                    placeholder="#F2C94C"
                    disabled={loading || !form.watch("enableDecor")}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Intensidad</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[Number(form.watch("decorIntensity") ?? 0.35)]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => form.setValue("decorIntensity", Number(v?.[0] ?? 0.35))}
                  disabled={loading || !form.watch("enableDecor")}
                />
                <span className="w-16 text-right text-sm text-muted-foreground">
                  {Math.round(Number(form.watch("decorIntensity") ?? 0.35) * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: si activas AnimeJS, los stickers flotan sutilmente. Si no, se quedan estáticos.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => form.reset(preferences)} disabled={loading}>
              Revertir
            </Button>
            <Button uiAction type="submit" disabled={loading}>
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
