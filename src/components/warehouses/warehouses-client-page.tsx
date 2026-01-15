"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { getWarehouses, type WarehouseListItem } from "@/actions/get-warehouses";
import { createWarehouseAction } from "@/actions/create-warehouse";
import { updateWarehouseAction } from "@/actions/update-warehouse";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";

export default function WarehousesClientPage() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<WarehouseListItem[]>([]);

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await getWarehouses();
      if (res.error) throw new Error(res.error);
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar almacenes");
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
    return (rows ?? []).filter((w) => String(w.name ?? "").toLowerCase().includes(t) || String(w.idWarehouse).includes(t));
  }, [rows, dq]);

  function openCreate() {
    setEditId(null);
    setName("");
    setOpen(true);
  }

  function openEdit(row: WarehouseListItem) {
    setEditId(row.idWarehouse);
    setName(row.name);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Nombre requerido");
      const res = editId
        ? await updateWarehouseAction({ idWarehouse: editId, name })
        : await createWarehouseAction({ name });

      if (!res.success) throw new Error(res.error || "No se pudo guardar");
      toast({ title: editId ? "Almacén actualizado" : "Almacén creado" });
      setOpen(false);
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
          <h1 className="text-3xl font-bold tracking-tight">Almacenes</h1>
          <p className="text-muted-foreground">CRUD de Warehouse (idWarehouse, name).</p>
        </div>
        <Button onClick={openCreate}>Nuevo almacén</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Listado</CardTitle>
          <div className="w-full max-w-sm">
            <Input placeholder="Buscar por nombre o ID…" value={q} onChange={(e) => setQ(e.target.value)} />
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
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.idWarehouse}>
                      <TableCell>{r.idWarehouse}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
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

      <Dialog open={open} onOpenChange={(v) => (saving ? null : setOpen(v))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar almacén" : "Nuevo almacén"}</DialogTitle>
            <DialogDescription>{editId ? `ID: ${editId}` : ""}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={save} disabled={saving || !name.trim()}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
