"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

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

import { listTaxesAdminAction, type TaxAdminRow } from "@/actions/list-taxes-admin";
import { createTaxAction } from "@/actions/create-tax";
import { updateTaxAction } from "@/actions/update-tax";

function formatRate(value: number) {
  const n = Number(value ?? 0);
  return `${Number.isFinite(n) ? n : 0}%`;
}

export default function TaxesClientPage() {
  const { toast } = useToast();

  const searchParams = useSearchParams();
  const didInitFromQuery = React.useRef(false);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<TaxAdminRow[]>([]);

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);

  React.useEffect(() => {
    if (didInitFromQuery.current) return;
    const qp = searchParams?.get("q");
    if (qp && String(qp).trim()) setQ(String(qp));
    didInitFromQuery.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [editId, setEditId] = React.useState<number | null>(null);

  const [name, setName] = React.useState("");
  const [rate, setRate] = React.useState<number>(0);
  const [code, setCode] = React.useState("");
  const [isEnabled, setIsEnabled] = React.useState(true);
  const [isFixed, setIsFixed] = React.useState(false);
  const [isTaxOnTotal, setIsTaxOnTotal] = React.useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listTaxesAdminAction();
      if (res.error) throw new Error(res.error);
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar impuestos");
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
    return (rows ?? []).filter((r) => {
      return (
        String(r.idTax).includes(t) ||
        r.name.toLowerCase().includes(t) ||
        String(r.code ?? "").toLowerCase().includes(t)
      );
    });
  }, [rows, dq]);

  function openCreate() {
    setEditId(null);
    setName("");
    setRate(0);
    setCode("");
    setIsEnabled(true);
    setIsFixed(false);
    setIsTaxOnTotal(false);
    setOpen(true);
  }

  function openEdit(row: TaxAdminRow) {
    setEditId(row.idTax);
    setName(row.name);
    setRate(Number(row.rate ?? 0));
    setCode(row.code ?? "");
    setIsEnabled(row.isEnabled !== false);
    setIsFixed(Boolean(row.isFixed));
    setIsTaxOnTotal(Boolean(row.isTaxOnTotal));
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      if (!name.trim()) throw new Error("Nombre requerido");
      if (!Number.isFinite(Number(rate)) || Number(rate) < 0) throw new Error("Tasa inválida");

      if (!editId) {
        const res = await createTaxAction({
          name,
          rate,
          code: code ? code : undefined,
          isEnabled,
          isFixed,
          isTaxOnTotal,
        });
        if (!res.success) throw new Error(res.error || "No se pudo crear");
        toast({ title: "Impuesto creado" });
      } else {
        const res = await updateTaxAction({
          idTax: editId,
          name,
          rate,
          code: code ? code : undefined,
          isEnabled,
          isFixed,
          isTaxOnTotal,
        });
        if (!res.success) throw new Error(res.error || "No se pudo actualizar");
        toast({ title: "Impuesto actualizado" });
      }

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
          <h1 className="text-3xl font-bold tracking-tight">Tasas de impuestos</h1>
          <p className="text-muted-foreground">CRUD de Tax (idTax, name, rate, flags).</p>
        </div>
        <Button onClick={openCreate}>Nuevo impuesto</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Listado</CardTitle>
          <div className="w-full max-w-sm">
            <Input placeholder="Buscar por nombre, código o ID…" value={q} onChange={(e) => setQ(e.target.value)} />
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
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-[140px]">Tasa</TableHead>
                    <TableHead className="w-[140px]">Código</TableHead>
                    <TableHead className="w-[120px]">Activo</TableHead>
                    <TableHead className="w-[120px]">Fijo</TableHead>
                    <TableHead className="w-[160px]">Sobre total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.idTax}>
                      <TableCell className="font-mono text-xs">{r.idTax}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{formatRate(r.rate)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.code ?? "-"}</TableCell>
                      <TableCell>{r.isEnabled ? "Sí" : "No"}</TableCell>
                      <TableCell>{r.isFixed ? "Sí" : "No"}</TableCell>
                      <TableCell>{r.isTaxOnTotal ? "Sí" : "No"}</TableCell>
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

          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              Refrescar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => (saving ? null : setOpen(v))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar impuesto" : "Nuevo impuesto"}</DialogTitle>
            <DialogDescription>{editId ? `ID: ${editId}` : "Crear impuesto"}</DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Tasa (%)</Label>
                <Input type="number" step="0.01" value={String(rate)} onChange={(e) => setRate(Number(e.target.value))} disabled={saving} />
              </div>
              <div className="grid gap-2">
                <Label>Código</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} placeholder="(opcional)" />
              </div>
              <div className="grid gap-2">
                <Label>Estado</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={isEnabled} onCheckedChange={(v) => setIsEnabled(Boolean(v))} disabled={saving} />
                  Activo
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isFixed} onCheckedChange={(v) => setIsFixed(Boolean(v))} disabled={saving} />
                Impuesto fijo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isTaxOnTotal} onCheckedChange={(v) => setIsTaxOnTotal(Boolean(v))} disabled={saving} />
                Calcula sobre total
              </label>
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
