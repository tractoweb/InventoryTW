"use client";

import * as React from "react";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";

import { createUser, type CreateUserInput } from "@/actions/create-user";
import { listUsersAction, type UserListRow } from "@/actions/list-users";
import { updateUserAction } from "@/actions/update-user";

const UserEditSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().min(1, "Usuario requerido"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), { message: "Email inválido" }),
  accessLevel: z.coerce.number().int().min(0),
  isEnabled: z.boolean().default(true),
  newPassword: z.string().optional(),
});

type UserEditValues = z.infer<typeof UserEditSchema>;

function accessLevelLabel(level: number) {
  if (level >= 9) return "Master";
  if (level >= 1) return "Administrador";
  return "Cajero";
}

export default function UsersClientPage() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<UserListRow[]>([]);

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");
  const [saving, setSaving] = React.useState(false);

  const form = useForm<UserEditValues>({
    resolver: zodResolver(UserEditSchema),
    defaultValues: {
      userId: 0,
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      accessLevel: 0,
      isEnabled: true,
      newPassword: "",
    },
  });

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listUsersAction();
      if (res.error) throw new Error(res.error);
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = React.useMemo(() => {
    const t = String(dq ?? "").trim().toLowerCase();
    if (!t) return rows;
    return (rows ?? []).filter((u) => {
      const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim().toLowerCase();
      return (
        String(u.userId).includes(t) ||
        u.username.toLowerCase().includes(t) ||
        fullName.includes(t) ||
        String(u.email ?? "").toLowerCase().includes(t)
      );
    });
  }, [rows, dq]);

  function openCreate() {
    setDialogMode("create");
    form.reset({
      userId: 0,
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      accessLevel: 0,
      isEnabled: true,
      newPassword: "",
    });
    setDialogOpen(true);
  }

  function openEdit(row: UserListRow) {
    setDialogMode("edit");
    form.reset({
      userId: row.userId,
      username: row.username,
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      email: row.email ?? "",
      accessLevel: row.accessLevel ?? 0,
      isEnabled: row.isEnabled !== false,
      newPassword: "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: UserEditValues) {
    setSaving(true);
    setError(null);

    try {
      if (dialogMode === "create") {
        const input: CreateUserInput = {
          username: values.username,
          password: values.newPassword ? values.newPassword : "1234",
          accessLevel: Number(values.accessLevel ?? 0),
          firstName: values.firstName ?? undefined,
          lastName: values.lastName ?? undefined,
          email: values.email ? values.email : undefined,
          isEnabled: Boolean(values.isEnabled),
        };

        if (!values.newPassword || values.newPassword.trim().length < 4) {
          throw new Error("Define una contraseña (mínimo 4 caracteres)");
        }

        const res = await createUser(input);
        if (!res.success) throw new Error(res.error ?? "No se pudo crear usuario");

        toast({ title: "Usuario creado", description: `#${res.user?.userId ?? ""} · ${values.username}` });
        setDialogOpen(false);
        await refresh();
        return;
      }

      // edit
      const res = await updateUserAction({
        userId: values.userId,
        username: values.username,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        accessLevel: values.accessLevel,
        isEnabled: values.isEnabled,
        ...(values.newPassword && values.newPassword.trim().length >= 4 ? { password: values.newPassword } : null),
      });

      if (!res.success) throw new Error(res.error ?? "No se pudo actualizar usuario");

      toast({ title: "Usuario actualizado", description: `#${values.userId} · ${values.username}` });
      setDialogOpen(false);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground">Gestión de usuarios y niveles de acceso.</p>
        </div>
        <Button onClick={openCreate}>Nuevo usuario</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Listado</CardTitle>
          <div className="w-full max-w-sm">
            <Input placeholder="Buscar por nombre, usuario o email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin resultados.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="hidden md:table-cell">Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Nivel</TableHead>
                    <TableHead className="hidden md:table-cell">Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell>{u.userId}</TableCell>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell className="hidden md:table-cell">{`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">{u.email ?? "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">{accessLevelLabel(u.accessLevel)}</TableCell>
                      <TableCell className="hidden md:table-cell">{u.isEnabled ? "Sí" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => (saving ? null : setDialogOpen(v))}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Nuevo usuario" : "Editar usuario"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "edit" ? `ID: ${form.watch("userId")}` : "Crear un usuario con accessLevel y estado."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Usuario</Label>
              <Input {...form.register("username")} disabled={saving} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input {...form.register("firstName")} disabled={saving} />
              </div>
              <div className="grid gap-2">
                <Label>Apellido</Label>
                <Input {...form.register("lastName")} disabled={saving} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" {...form.register("email")} disabled={saving} />
            </div>

            <div className="grid gap-2">
              <Label>Nivel de acceso</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={String(form.watch("accessLevel") ?? 0)}
                onChange={(e) => form.setValue("accessLevel", Number(e.target.value))}
                disabled={saving}
              >
                <option value={0}>Cajero</option>
                <option value={1}>Administrador</option>
                <option value={9}>Master</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.watch("isEnabled"))}
                onCheckedChange={(v) => form.setValue("isEnabled", Boolean(v))}
                disabled={saving}
              />
              Usuario habilitado
            </label>

            <div className="grid gap-2">
              <Label>{dialogMode === "create" ? "Contraseña" : "Nueva contraseña (opcional)"}</Label>
              <Input type="password" {...form.register("newPassword")} disabled={saving} placeholder={dialogMode === "create" ? "mínimo 4 caracteres" : "dejar vacío para no cambiar"} />
              {dialogMode === "edit" ? (
                <p className="text-xs text-muted-foreground">Si lo dejas vacío, no cambia la contraseña.</p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
