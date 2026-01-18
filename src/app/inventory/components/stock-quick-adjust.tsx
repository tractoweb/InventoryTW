"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function StockQuickAdjust(props: {
  productId: number;
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const warehouses = props.warehouses ?? [];

  const defaultWarehouseId = useMemo(() => {
    const first = warehouses?.[0]?.idWarehouse;
    return Number.isFinite(Number(first)) ? String(first) : "";
  }, [warehouses]);

  const [warehouseId, setWarehouseId] = useState<string>(defaultWarehouseId);
  const [amount, setAmount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const qty = Math.trunc(Number(amount));
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
      toast({
        title: "Stock actualizado",
        description: "El stock fue ajustado correctamente.",
      });
      router.refresh();
      return;
    }

    toast({
      variant: "destructive",
      title: "Error al ajustar stock",
      description: result.error || "No se pudo ajustar el stock.",
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
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
            Ajuste rápido por almacén (no muestra detalles del producto).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Cantidad</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={String(amount)}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="max-w-[160px]"
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
      </div>
    </div>
  );
}
