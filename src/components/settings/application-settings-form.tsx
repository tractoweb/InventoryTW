"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { getApplicationSettings, type ApplicationSettingsDto } from "@/actions/get-application-settings";
import { updateApplicationSettingsAction } from "@/actions/update-application-settings";
import { getWarehouses, type WarehouseListItem } from "@/actions/get-warehouses";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const Schema = z.object({
  companyId: z.number().int().positive(),
  organizationName: z.string().optional(),
  primaryColor: z.string().optional(),
  currencySymbol: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  taxPercentage: z.coerce.number().min(0).max(100).optional(),
  allowNegativeStock: z.boolean().optional(),
  defaultWarehouseId: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof Schema>;

export default function ApplicationSettingsForm(props: { companyId?: number }) {
  const { toast } = useToast();
  const companyId = props.companyId ?? 1;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [warehouses, setWarehouses] = React.useState<WarehouseListItem[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      companyId,
      organizationName: "",
      primaryColor: "#1f2937",
      currencySymbol: "$",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "HH:mm:ss",
      taxPercentage: 19,
      allowNegativeStock: false,
      defaultWarehouseId: undefined,
    },
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [sRes, wRes] = await Promise.all([getApplicationSettings({ companyId }), getWarehouses()]);
      if (sRes.error) throw new Error(sRes.error);
      if (wRes.error) throw new Error(wRes.error);

      const s = sRes.data as ApplicationSettingsDto | undefined;
      setWarehouses(wRes.data ?? []);

      form.reset({
        companyId,
        organizationName: s?.organizationName ?? "",
        primaryColor: s?.primaryColor ?? "#1f2937",
        currencySymbol: s?.currencySymbol ?? "$",
        dateFormat: s?.dateFormat ?? "YYYY-MM-DD",
        timeFormat: s?.timeFormat ?? "HH:mm:ss",
        taxPercentage: s?.taxPercentage ?? 19,
        allowNegativeStock: Boolean(s?.allowNegativeStock ?? false),
        defaultWarehouseId: s?.defaultWarehouseId ?? undefined,
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar settings");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function onSubmit(values: FormValues) {
    setError(null);
    const res = await updateApplicationSettingsAction({
      ...values,
      defaultWarehouseId:
        values.defaultWarehouseId !== undefined && values.defaultWarehouseId !== null && String(values.defaultWarehouseId).trim() !== ""
          ? Number(values.defaultWarehouseId)
          : undefined,
    });
    if (!res.success) {
      setError(res.error || "No se pudo guardar");
      return;
    }
    toast({ title: "Settings guardados", description: "Preferencias de aplicación actualizadas" });
    await load();
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ApplicationSettings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias de Aplicación</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <Label>Nombre organización</Label>
            <Input {...form.register("organizationName")} placeholder="TRACTO AGRÍCOLA" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Color primario</Label>
              <Input {...form.register("primaryColor")} placeholder="#1f2937" />
            </div>
            <div className="grid gap-2">
              <Label>Símbolo moneda</Label>
              <Input {...form.register("currencySymbol")} placeholder="$" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Formato fecha</Label>
              <Input {...form.register("dateFormat")} placeholder="YYYY-MM-DD" />
            </div>
            <div className="grid gap-2">
              <Label>Formato hora</Label>
              <Input {...form.register("timeFormat")} placeholder="HH:mm:ss" />
            </div>
            <div className="grid gap-2">
              <Label>IVA (%)</Label>
              <Input type="number" step="0.01" {...form.register("taxPercentage")} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Almacén por defecto</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.watch("defaultWarehouseId") ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  form.setValue("defaultWarehouseId", v ? Number(v) : undefined);
                }}
              >
                <option value="">(Sin default)</option>
                {(warehouses ?? []).map((w) => (
                  <option key={w.idWarehouse} value={w.idWarehouse}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Inventario</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(form.watch("allowNegativeStock"))}
                  onCheckedChange={(v) => form.setValue("allowNegativeStock", Boolean(v))}
                />
                Permitir stock negativo
              </label>
              <p className="text-xs text-muted-foreground">
                Si está desactivado, no se permite finalizar documentos de salida que dejen stock &lt; 0.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={load}>
              Recargar
            </Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
