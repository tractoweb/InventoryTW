"use client";

import * as React from "react";

import { getWarehouses, type WarehouseListItem } from "@/actions/get-warehouses";
import { getDocumentTypes, type DocumentTypeListItem } from "@/actions/get-document-types";
import { getPosSalidasConfigAction } from "@/actions/get-pos-salidas-config";
import { updatePosSalidasConfigAction } from "@/actions/update-pos-salidas-config";

import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

function normalizeLoose(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}

export function PosSalidasSettingsCard() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [warehouses, setWarehouses] = React.useState<WarehouseListItem[]>([]);
  const [documentTypes, setDocumentTypes] = React.useState<DocumentTypeListItem[]>([]);

  const [warehouseId, setWarehouseId] = React.useState<number | "">("");
  const [defaultDocumentTypeId, setDefaultDocumentTypeId] = React.useState<number | "" | "none">("");

  const availableDocTypes = React.useMemo(() => {
    const wid = typeof warehouseId === "number" ? warehouseId : null;
    const forWh = (documentTypes ?? []).filter((d) => (wid ? Number(d.warehouseId ?? 0) === wid : true));
    const outs = forWh.filter((d) => {
      const sd = Number(d.stockDirection ?? 0);
      return (Number.isFinite(sd) && sd < 0) || sd === 2;
    });
    return outs.length ? outs : forWh;
  }, [documentTypes, warehouseId]);

  async function loadConfig(wid: number) {
    const res = await getPosSalidasConfigAction({ warehouseId: wid });
    const dt = res?.data?.defaultDocumentTypeId ?? null;
    if (dt && availableDocTypes.some((d) => Number(d.documentTypeId) === dt)) {
      setDefaultDocumentTypeId(dt);
      return;
    }
    if (dt) {
      // Config points to a type that is not available for this warehouse.
      setDefaultDocumentTypeId("none");
      return;
    }

    const preferred = availableDocTypes.find((d) => normalizeLoose(d.name).includes("SALIDA")) ?? availableDocTypes[0];
    if (preferred) setDefaultDocumentTypeId(Number(preferred.documentTypeId));
    else setDefaultDocumentTypeId("none");
  }

  React.useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const [wRes, dtRes] = await Promise.all([getWarehouses({ onlyEnabled: true }), getDocumentTypes()]);
        if (wRes.error) throw new Error(wRes.error);
        if (dtRes.error) throw new Error(dtRes.error);

        const wh = wRes.data ?? [];
        setWarehouses(wh);
        setDocumentTypes(dtRes.data ?? []);

        const first = wh[0]?.idWarehouse ? Number(wh[0].idWarehouse) : null;
        if (first) {
          setWarehouseId(first);
        }
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo cargar configuración" });
      } finally {
        setLoading(false);
      }
    }

    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (typeof warehouseId !== "number") return;
    void loadConfig(warehouseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, documentTypes]);

  async function save() {
    if (saving) return;
    if (typeof warehouseId !== "number") {
      toast({ variant: "destructive", title: "Falta bodega", description: "Seleccione una bodega" });
      return;
    }

    setSaving(true);
    try {
      const dt = defaultDocumentTypeId === "none" || defaultDocumentTypeId === "" ? null : Number(defaultDocumentTypeId);
      const res = await updatePosSalidasConfigAction({ warehouseId, defaultDocumentTypeId: dt });
      if (!res.success) throw new Error(res.error ?? "No se pudo guardar");
      toast({ title: "Configuración guardada", description: "Tipo de salida por bodega actualizado." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>POS · Salidas</CardTitle>
          <CardDescription>Configuración por bodega.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>POS · Salidas</CardTitle>
        <CardDescription>Define el tipo de documento por defecto para las salidas rápidas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label>Bodega</Label>
          <Select value={typeof warehouseId === "number" ? String(warehouseId) : ""} onValueChange={(v) => setWarehouseId(Number(v))}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Seleccione bodega" />
            </SelectTrigger>
            <SelectContent>
              {(warehouses ?? []).map((w) => (
                <SelectItem key={w.idWarehouse} value={String(w.idWarehouse)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Tipo de documento (salida)</Label>
          <Select
            value={defaultDocumentTypeId === "none" ? "" : defaultDocumentTypeId === "" ? "" : String(defaultDocumentTypeId)}
            onValueChange={(v) => setDefaultDocumentTypeId(Number(v))}
            disabled={typeof warehouseId !== "number"}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder={availableDocTypes.length ? "Seleccione tipo" : "No hay tipos para esta bodega"} />
            </SelectTrigger>
            <SelectContent>
              {(availableDocTypes ?? []).map((dt) => (
                <SelectItem key={dt.documentTypeId} value={String(dt.documentTypeId)}>
                  {dt.name} ({dt.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
