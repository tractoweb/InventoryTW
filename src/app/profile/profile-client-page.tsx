"use client";

import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import { getMyProfileAction } from "@/actions/profile/get-my-profile";
import { updateMyProfileAction } from "@/actions/profile/update-my-profile";

export function ProfileClientPage() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [username, setUsername] = React.useState("-");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getMyProfileAction();
        if (res?.error) throw new Error(res.error);
        const d = res?.data;
        setUsername(String(d?.username ?? ""));
        setFirstName(String(d?.firstName ?? ""));
        setLastName(String(d?.lastName ?? ""));
        setEmail(String(d?.email ?? ""));
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo cargar el perfil" });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [toast]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await updateMyProfileAction({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        password: password.trim() ? password.trim() : undefined,
      });

      if (!res?.success) throw new Error(res?.error ?? "No se pudo guardar");

      setPassword("");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("session:refresh"));
      }
      toast({ title: "Perfil actualizado", description: "Los cambios se guardaron correctamente." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground">Edita tu información básica.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mi cuenta</CardTitle>
          <CardDescription>Usuario: {username}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Nombres</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading || saving} />
          </div>
          <div className="grid gap-2">
            <Label>Apellidos</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading || saving} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading || saving} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Nueva contraseña (opcional)</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar vacío para no cambiar"
              disabled={loading || saving}
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
