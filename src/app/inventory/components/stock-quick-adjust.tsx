"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Warehouse } from "@/actions/get-warehouses";
import { changeStock } from "@/actions/change-stock";
import { adjustStock } from "@/actions/adjust-stock";
import { getStockForProductsAction } from "@/actions/get-stock-for-products";
import { refreshStockCache } from "@/actions/refresh-stock-cache";

export function StockQuickAdjust(props: {
  productId: number;
  productName?: string;
  productCode?: string;
  warehouses: Warehouse[];
  defaultWarehouseId?: number;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const warehouses = props.warehouses ?? [];

  const defaultWarehouseId = useMemo(() => {
    const preferred = props.defaultWarehouseId ?? warehouses?.[0]?.idWarehouse;
    return Number.isFinite(Number(preferred)) ? String(preferred) : "";
  }, [props.defaultWarehouseId, warehouses]);

  const [warehouseId, setWarehouseId] = useState<string>(defaultWarehouseId);
  const [deltaAmount, setDeltaAmount] = useState<number>(1);
  const [setAmount, setSetAmount] = useState<number>(0);
  const [currentQty, setCurrentQty] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultPayload, setResultPayload] = useState<{
    productId: number;
    productName?: string;
    productCode?: string;
    warehouseName?: string;
    previousQty?: number | null;
    newQty?: number | null;
    reason?: string;
  } | null>(null);

  const selectedWarehouseName = useMemo(() => {
    const whId = Number(warehouseId);
    const wh = warehouses.find((w) => Number(w.idWarehouse) === whId);
    return wh?.name ? String(wh.name) : undefined;
  }, [warehouseId, warehouses]);

  useEffect(() => {
    // If the stock page changes the preferred warehouse, keep this in sync.
    if (!props.defaultWarehouseId) return;
    const next = String(props.defaultWarehouseId);
    if (next && next !== warehouseId) setWarehouseId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.defaultWarehouseId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const whId = Number(warehouseId);
      if (!Number.isFinite(whId) || whId <= 0) {
        setCurrentQty(null);
        return;
      }

      try {
        const res = await getStockForProductsAction({
          warehouseId: whId,
          productIds: [props.productId],
        });
        if (cancelled) return;
        if (res.error) throw new Error(res.error);
        const qty = Number(res.data?.[props.productId] ?? 0);
        setCurrentQty(Number.isFinite(qty) ? qty : 0);
      } catch {
        if (!cancelled) setCurrentQty(null);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [warehouseId, props.productId]);

  async function applyDelta(deltaSign: 1 | -1) {
    const whId = Number(warehouseId);
    if (!Number.isFinite(whId) || whId <= 0) {
      toast({
        variant: "destructive",
        title: "Selecciona un almacén",
        description: "Debes elegir un almacén para ajustar el stock.",
      });
      return;
    }

    const qty = Math.trunc(Number(deltaAmount));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({
        variant: "destructive",
        title: "Cantidad inválida",
        description: "Ingresa una cantidad mayor a 0.",
      });
      return;
    }

    setIsSubmitting(true);
    const result = await changeStock({
      productId: props.productId,
      warehouseId: whId,
      delta: deltaSign * qty,
    });
    setIsSubmitting(false);

    if (result.success) {
      const nextQty =
        typeof result.newQuantity === "number" && Number.isFinite(result.newQuantity)
          ? result.newQuantity
          : typeof currentQty === "number"
            ? Math.max(0, currentQty + deltaSign * qty)
            : null;

      const reason = `Ajuste rápido (${deltaSign * qty > 0 ? "+" : ""}${deltaSign * qty})`;

      setCurrentQty(typeof nextQty === "number" ? nextQty : currentQty);
      setResultPayload({
        productId: props.productId,
        productName: props.productName,
        productCode: props.productCode,
        warehouseName: selectedWarehouseName,
        previousQty: currentQty,
        newQty: nextQty,
        reason,
      });
      setResultOpen(true);

      await refreshStockCache();
      router.refresh();
      return;
    }

    toast({
      variant: "destructive",
      title: "Error al ajustar stock",
      description: result.error || "No se pudo ajustar el stock.",
    });
  }

  async function applySet() {
    const whId = Number(warehouseId);
    if (!Number.isFinite(whId) || whId <= 0) {
      toast({
        variant: "destructive",
        title: "Selecciona un almacén",
        description: "Debes elegir un almacén para ajustar el stock.",
      });
      return;
    }

    const qty = Math.trunc(Number(setAmount));
    if (!Number.isFinite(qty) || qty < 0) {
      toast({
        variant: "destructive",
        title: "Cantidad inválida",
        description: "Ingresa una cantidad mayor o igual a 0.",
      });
      return;
    }

    setIsSubmitting(true);
    const result = await adjustStock({
      productId: props.productId,
      warehouseId: whId,
      quantity: qty,
      reason: "Establecer stock (desde Stock)",
    } as any);
    setIsSubmitting(false);

    if (result?.success) {
      const nextQty =
        typeof (result as any)?.newQuantity === "number" && Number.isFinite((result as any).newQuantity)
          ? Number((result as any).newQuantity)
          : qty;

      setCurrentQty(nextQty);
      setResultPayload({
        productId: props.productId,
        productName: props.productName,
        productCode: props.productCode,
        warehouseName: selectedWarehouseName,
        previousQty: currentQty,
        newQty: nextQty,
        reason: "Establecer stock",
      });
      setResultOpen(true);

      await refreshStockCache();
      router.refresh();
      return;
    }

    toast({
      variant: "destructive",
      title: "Error al ajustar stock",
      description: result?.error || "No se pudo ajustar el stock.",
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock actualizado</DialogTitle>
            <DialogDescription>
              Cambio registrado y trazado en Kardex.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Producto:</span>{" "}
              <span className="font-medium">
                {resultPayload?.productName || `#${resultPayload?.productId ?? props.productId}`}
              </span>
              {resultPayload?.productCode ? (
                <span className="text-muted-foreground"> ({resultPayload.productCode})</span>
              ) : null}
            </div>
            <div>
              <span className="text-muted-foreground">Almacén:</span>{" "}
              <span className="font-medium">{resultPayload?.warehouseName || "—"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Antes</div>
                <div className="text-lg font-semibold">{resultPayload?.previousQty ?? "—"}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Ahora</div>
                <div className="text-lg font-semibold">{resultPayload?.newQty ?? "—"}</div>
              </div>
            </div>
            {resultPayload?.reason ? (
              <div>
                <span className="text-muted-foreground">Motivo:</span>{" "}
                <span className="font-medium">{resultPayload.reason}</span>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setResultOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Almacén</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un almacén" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((wh) => (
                <SelectItem key={wh.idWarehouse} value={String(wh.idWarehouse)}>
                  {wh.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Stock actual: <span className="font-medium">{currentQty ?? "—"}</span>
          </p>
        </div>

        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cantidad (ajuste +/-)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={String(deltaAmount)}
                onChange={(e) => setDeltaAmount(Number(e.target.value))}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => applyDelta(-1)}
                  disabled={isSubmitting}
                >
                  Bajar
                </Button>
                <Button onClick={() => applyDelta(1)} disabled={isSubmitting}>
                  Subir
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Establecer cantidad</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={String(setAmount)}
                onChange={(e) => setSetAmount(Number(e.target.value))}
              />
              <Button variant="secondary" onClick={applySet} disabled={isSubmitting}>
                Establecer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
