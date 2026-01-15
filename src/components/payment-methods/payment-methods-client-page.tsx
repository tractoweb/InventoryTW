"use client";

import * as React from "react";

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

import {
  listPaymentTypesAdminAction,
  type PaymentTypeAdminRow,
} from "@/actions/list-payment-types-admin";
import { createPaymentTypeAction } from "@/actions/create-payment-type";
import { updatePaymentTypeAction } from "@/actions/update-payment-type";

export default function PaymentMethodsClientPage() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<PaymentTypeAdminRow[]>([]);

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [editId, setEditId] = React.useState<number | null>(null);

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [ordinal, setOrdinal] = React.useState<number>(0);
  const [shortcutKey, setShortcutKey] = React.useState("");

  const [isEnabled, setIsEnabled] = React.useState(true);
  const [isQuickPayment, setIsQuickPayment] = React.useState(true);
  const [openCashDrawer, setOpenCashDrawer] = React.useState(true);
  const [isChangeAllowed, setIsChangeAllowed] = React.useState(true);
  const [markAsPaid, setMarkAsPaid] = React.useState(true);

  const [isCustomerRequired, setIsCustomerRequired] = React.useState(false);
  const [isFiscal, setIsFiscal] = React.useState(true);
  const [isSlipRequired, setIsSlipRequired] = React.useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const res = await listPaymentTypesAdminAction();
      if (res.error) throw new Error(res.error);
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar las formas de pago");
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
        String(r.paymentTypeId).includes(t) ||
        r.name.toLowerCase().includes(t) ||
        String(r.code ?? "").toLowerCase().includes(t) ||
        String(r.shortcutKey ?? "").toLowerCase().includes(t)
      );
    });
  }, [rows, dq]);

  function openCreate() {
    setEditId(null);
    setName("");
    setCode("");
    setOrdinal(0);
    setShortcutKey("");

    setIsEnabled(true);
    setIsQuickPayment(true);
    setOpenCashDrawer(true);
    setIsChangeAllowed(true);
    setMarkAsPaid(true);

    setIsCustomerRequired(false);
    setIsFiscal(true);
    setIsSlipRequired(false);

    setOpen(true);
  }

  function openEdit(row: PaymentTypeAdminRow) {
    setEditId(row.paymentTypeId);
    setName(row.name);
    setCode(row.code ?? "");
    setOrdinal(Number(row.ordinal ?? 0) || 0);
    setShortcutKey(row.shortcutKey ?? "");

    setIsEnabled(Boolean(row.isEnabled));
    setIsQuickPayment(Boolean(row.isQuickPayment));
    setOpenCashDrawer(Boolean(row.openCashDrawer));
    setIsChangeAllowed(Boolean(row.isChangeAllowed));
    setMarkAsPaid(Boolean(row.markAsPaid));

    setIsCustomerRequired(Boolean(row.isCustomerRequired));
    setIsFiscal(Boolean(row.isFiscal));
    setIsSlipRequired(Boolean(row.isSlipRequired));

    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      if (!name.trim()) throw new Error("Nombre requerido");
      if (!Number.isFinite(Number(ordinal)) || Number(ordinal) < 0) throw new Error("Orden inválido");

      if (!editId) {
        const res = await createPaymentTypeAction({
          name,
          code: code ? code : undefined,
          ordinal,
          shortcutKey: shortcutKey ? shortcutKey : undefined,
          isEnabled,
          isQuickPayment,
          openCashDrawer,
          isChangeAllowed,
          markAsPaid,
          isCustomerRequired,
          isFiscal,
          isSlipRequired,
        });
        if (!res.success) throw new Error(res.error || "No se pudo crear");
        toast({ title: "Forma de pago creada" });
      } else {
        const res = await updatePaymentTypeAction({
          paymentTypeId: editId,
          name,
          code: code ? code : undefined,
          ordinal,
          shortcutKey: shortcutKey ? shortcutKey : undefined,
          isEnabled,
          isQuickPayment,
          openCashDrawer,
          isChangeAllowed,
          markAsPaid,
          isCustomerRequired,
          isFiscal,
          isSlipRequired,
        });
        if (!res.success) throw new Error(res.error || "No se pudo actualizar");
        toast({ title: "Forma de pago actualizada" });
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
          <h1 className="text-3xl font-bold tracking-tight">Formas de pago</h1>
          <p className="text-muted-foreground">CRUD de PaymentType (catálogo de caja/POS).</p>
        </div>
        <Button onClick={openCreate}>Nueva forma de pago</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Listado</CardTitle>
          <div className="w-full max-w-sm">
            <Input
              placeholder="Buscar por nombre, código, ID o atajo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
                    <TableHead className="w-[90px]">ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-[140px]">Código</TableHead>
                    <TableHead className="w-[110px]">Orden</TableHead>
                    <TableHead className="w-[110px]">Activo</TableHead>
                    <TableHead className="w-[120px]">Rápido</TableHead>
                    <TableHead className="w-[120px]">Caja</TableHead>
                    <TableHead className="w-[120px]">Fiscal</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.paymentTypeId}>
                      <TableCell className="font-mono text-xs">{r.paymentTypeId}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.code ?? "-"}</TableCell>
                      <TableCell>{r.ordinal ?? 0}</TableCell>
                      <TableCell>{r.isEnabled ? "Sí" : "No"}</TableCell>
                      <TableCell>{r.isQuickPayment ? "Sí" : "No"}</TableCell>
                      <TableCell>{r.openCashDrawer ? "Sí" : "No"}</TableCell>
                      <TableCell>{r.isFiscal ? "Sí" : "No"}</TableCell>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar forma de pago" : "Nueva forma de pago"}</DialogTitle>
            <DialogDescription>{editId ? `ID: ${editId}` : "Crear forma de pago"}</DialogDescription>
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

            <div className="grid gap-4 md:grid-cols-4">
              <div className="grid gap-2 md:col-span-2">
                <Label>Código</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} placeholder="(opcional)" />
              </div>
              <div className="grid gap-2">
                <Label>Orden</Label>
                <Input
                  type="number"
                  step="1"
                  value={String(ordinal)}
                  onChange={(e) => setOrdinal(Number(e.target.value))}
                  disabled={saving}
                />
              </div>
              <div className="grid gap-2">
                <Label>Atajo</Label>
                <Input value={shortcutKey} onChange={(e) => setShortcutKey(e.target.value)} disabled={saving} placeholder="(opcional)" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isEnabled} onCheckedChange={(v) => setIsEnabled(Boolean(v))} disabled={saving} />
                Activo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isQuickPayment} onCheckedChange={(v) => setIsQuickPayment(Boolean(v))} disabled={saving} />
                Pago rápido
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={openCashDrawer} onCheckedChange={(v) => setOpenCashDrawer(Boolean(v))} disabled={saving} />
                Abre cajón
              </label>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={markAsPaid} onCheckedChange={(v) => setMarkAsPaid(Boolean(v))} disabled={saving} />
                Marcar como pagado
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isChangeAllowed} onCheckedChange={(v) => setIsChangeAllowed(Boolean(v))} disabled={saving} />
                Permite cambio
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isCustomerRequired} onCheckedChange={(v) => setIsCustomerRequired(Boolean(v))} disabled={saving} />
                Requiere cliente
              </label>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isFiscal} onCheckedChange={(v) => setIsFiscal(Boolean(v))} disabled={saving} />
                Fiscal
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isSlipRequired} onCheckedChange={(v) => setIsSlipRequired(Boolean(v))} disabled={saving} />
                Requiere comprobante
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
