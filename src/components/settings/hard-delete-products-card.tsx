"use client";

import * as React from "react";

import { listSoftDeletedProductsAction, type SoftDeletedProductRow } from "@/actions/list-soft-deleted-products";
import { hardDeleteProductAction } from "@/actions/hard-delete-product";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

function formatBlockedBy(blockedBy?: Array<{ table: string; count: number }>): string {
  if (!blockedBy || blockedBy.length === 0) return "";
  return blockedBy
    .map((b) => `${b.table}${b.count ? ` (${b.count})` : ""}`)
    .join(", ");
}

export function HardDeleteProductsCard() {
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<SoftDeletedProductRow[]>([]);
  const [nextToken, setNextToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [confirming, setConfirming] = React.useState<SoftDeletedProductRow | null>(null);
  const [confirmText, setConfirmText] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  async function load(opts?: { reset?: boolean }) {
    const reset = Boolean(opts?.reset);

    setLoading(true);
    try {
      const res = await listSoftDeletedProductsAction({
        q,
        limit: 25,
        nextToken: reset ? null : nextToken,
      });

      if (res.error) {
        toast({ variant: "destructive", title: "No se pudo cargar", description: res.error });
        return;
      }

      if (reset) {
        setRows(res.data ?? []);
      } else {
        setRows((prev) => [...prev, ...(res.data ?? [])]);
      }

      setNextToken(res.nextToken ?? null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    setRows([]);
    setNextToken(null);
    void load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setRows([]);
      setNextToken(null);
      void load({ reset: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function doHardDelete(productId: number) {
    setDeleting(true);
    try {
      const res = await hardDeleteProductAction({ productId });
      if (!res.success) {
        const extra = formatBlockedBy(res.blockedBy);
        toast({
          variant: "destructive",
          title: "No se pudo eliminar",
          description: extra ? `${res.error ?? "Error"}. Bloqueado por: ${extra}` : (res.error ?? "Error"),
        });
        return;
      }

      toast({ title: "Listo", description: res.message ?? "Producto eliminado definitivamente." });

      // Refresh list
      setConfirming(null);
      setConfirmText("");
      setRows([]);
      setNextToken(null);
      await load({ reset: true });
    } finally {
      setDeleting(false);
    }
  }

  const canConfirm = confirmText.trim().toUpperCase() === "ELIMINAR";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eliminación definitiva (Master)</CardTitle>
        <CardDescription>
          Elimina permanentemente productos desactivados (SOFT_DELETE) solo si no tienen trazabilidad (sin documentos/kardex/stock).
          La auditoría conserva un snapshot del registro eliminado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={(v) => (deleting ? null : setOpen(v))}>
          <DialogTrigger asChild>
            <Button variant="destructive">Gestionar productos desactivados</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Productos desactivados</DialogTitle>
              <DialogDescription>
                Solo se puede eliminar definitivamente si no hay registros relacionados. Para confirmar, escribe “ELIMINAR”.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre o código…"
              />
              <Button variant="outline" onClick={() => load({ reset: true })} disabled={loading}>
                {loading ? "Cargando…" : "Buscar"}
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-[180px]">Código</TableHead>
                    <TableHead className="w-[140px] text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        {loading ? "Cargando…" : "No hay productos desactivados para mostrar."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.id}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.code ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog open={confirming?.id === r.id}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setConfirming(r);
                                  setConfirmText("");
                                }}
                              >
                                Eliminar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar definitivamente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esto borrará el producto de la base de datos. La auditoría conservará un snapshot, pero la trazabilidad
                                  puede romperse si existen relaciones. El sistema bloqueará la operación si detecta dependencias.
                                </AlertDialogDescription>
                              </AlertDialogHeader>

                              <div className="space-y-2">
                                <div className="rounded-md border p-3 text-sm">
                                  <div><strong>ID:</strong> {r.id}</div>
                                  <div><strong>Nombre:</strong> {r.name}</div>
                                  <div><strong>Código:</strong> {r.code ?? "—"}</div>
                                </div>
                                <Input
                                  value={confirmText}
                                  onChange={(e) => setConfirmText(e.target.value)}
                                  placeholder='Escribe "ELIMINAR" para confirmar'
                                  disabled={deleting}
                                />
                              </div>

                              <AlertDialogFooter>
                                <AlertDialogCancel
                                  onClick={() => {
                                    setConfirming(null);
                                    setConfirmText("");
                                  }}
                                  disabled={deleting}
                                >
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (!canConfirm) return;
                                    void doHardDelete(r.id);
                                  }}
                                  disabled={!canConfirm || deleting}
                                >
                                  {deleting ? "Eliminando…" : "Confirmar"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {rows.length > 0 ? `${rows.length} item(s)` : ""}
              </div>
              <Button
                variant="outline"
                onClick={() => load({ reset: false })}
                disabled={loading || !nextToken}
              >
                {loading ? "Cargando…" : nextToken ? "Cargar más" : "Sin más"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
