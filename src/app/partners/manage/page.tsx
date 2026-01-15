"use client";

import * as React from "react";
import Link from "next/link";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";

import { searchCustomersAction, type CustomerSearchResult } from "@/actions/search-customers";
import { getCountries, type CountryListItem } from "@/actions/get-countries";
import { getCustomerDetails } from "@/actions/get-customer-details";
import { updateCustomerAction } from "@/actions/update-customer";

const CustomerFormSchema = z.object({
  idCustomer: z.number().int().min(1),
  name: z.string().min(1, "Nombre requerido"),
  code: z.string().optional(),
  taxNumber: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryId: z.number().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  dueDatePeriod: z.number().int().min(0).optional(),
  isTaxExempt: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  isCustomer: z.boolean().optional(),
});

type CustomerFormValues = z.infer<typeof CustomerFormSchema>;

function boolLabel(v: any) {
  return v === false ? "No" : "Sí";
}

export default function PartnersManagePage() {
  const { toast } = useToast();

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<CustomerSearchResult[]>([]);

  const [countries, setCountries] = React.useState<CountryListItem[]>([]);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(CustomerFormSchema),
    defaultValues: {
      idCustomer: 0,
      name: "",
      code: "",
      taxNumber: "",
      address: "",
      postalCode: "",
      city: "",
      countryId: undefined,
      email: "",
      phoneNumber: "",
      dueDatePeriod: 0,
      isTaxExempt: false,
      isEnabled: true,
      isSupplier: true,
      isCustomer: false,
    },
  });

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await searchCustomersAction(dq, 100, {});
      if (res?.error) throw new Error(String(res.error));
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar customers");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let alive = true;
    async function boot() {
      setLoading(true);
      try {
        const [cRes, listRes] = await Promise.all([
          getCountries(),
          searchCustomersAction("", 100, {}),
        ]);
        if (!alive) return;
        setCountries(cRes.data ?? []);
        setRows(listRes.data ?? []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo cargar la información");
      } finally {
        if (alive) setLoading(false);
      }
    }
    boot();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  async function openEdit(idCustomer: number) {
    setEditOpen(true);
    setEditLoading(true);
    setEditError(null);
    setEditingId(idCustomer);

    try {
      const res = await getCustomerDetails(idCustomer);
      if (res?.error) throw new Error(String(res.error));
      const c = res.data;
      if (!c) throw new Error("No se pudo cargar el customer");

      form.reset({
        idCustomer: Number(c.idCustomer),
        name: String(c.name ?? ""),
        code: c.code ?? "",
        taxNumber: c.taxNumber ?? "",
        address: c.address ?? "",
        postalCode: c.postalCode ?? "",
        city: c.city ?? "",
        countryId: c.countryId ?? undefined,
        email: c.email ?? "",
        phoneNumber: c.phoneNumber ?? "",
        dueDatePeriod: Number(c.dueDatePeriod ?? 0),
        isTaxExempt: Boolean(c.isTaxExempt ?? false),
        isEnabled: c.isEnabled !== false,
        isSupplier: c.isSupplier !== false,
        isCustomer: Boolean(c.isCustomer ?? false),
      });
    } catch (e: any) {
      setEditError(e?.message ?? "No se pudo abrir el editor");
    } finally {
      setEditLoading(false);
    }
  }

  async function onSubmit(values: CustomerFormValues) {
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await updateCustomerAction({
        ...values,
        countryId: values.countryId === undefined ? undefined : Number(values.countryId),
        dueDatePeriod: values.dueDatePeriod === undefined ? undefined : Number(values.dueDatePeriod),
      });
      if (!res?.success) throw new Error(String(res?.error ?? "No se pudo guardar"));

      toast({
        title: "Customer actualizado",
        description: `ID ${values.idCustomer} · ${values.name}`,
      });

      setEditOpen(false);
      setEditingId(null);
      await refresh();
    } catch (e: any) {
      setEditError(e?.message ?? "No se pudo guardar");
    } finally {
      setEditLoading(false);
    }
  }

  const countryOptions = React.useMemo(() => {
    return (countries ?? []).map((c) => ({
      value: Number(c.idCountry),
      label: String(c.name ?? c.idCountry),
    }));
  }, [countries]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Customers</h1>
          <p className="text-muted-foreground">Gestión de clientes/proveedores (modelo Customer).</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/partners">Volver</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Listado</CardTitle>
          <div className="w-full max-w-sm">
            <Input
              placeholder="Buscar por nombre, código o NIT…"
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
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin resultados.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Código</TableHead>
                    <TableHead className="hidden md:table-cell">NIT</TableHead>
                    <TableHead className="hidden md:table-cell">Ciudad</TableHead>
                    <TableHead className="hidden md:table-cell">Activo</TableHead>
                    <TableHead className="hidden md:table-cell">Proveedor</TableHead>
                    <TableHead className="hidden md:table-cell">Cliente</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.idCustomer}>
                      <TableCell>{r.idCustomer}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.code ?? "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.taxNumber ?? "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.city ?? "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">{boolLabel(r.isEnabled)}</TableCell>
                      <TableCell className="hidden md:table-cell">{boolLabel(r.isSupplier)}</TableCell>
                      <TableCell className="hidden md:table-cell">{boolLabel(r.isCustomer)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r.idCustomer)}>
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

      <Dialog open={editOpen} onOpenChange={(v) => (editLoading ? null : setEditOpen(v))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Customer</DialogTitle>
            <DialogDescription>
              {editingId ? `ID: ${editingId}` : ""}
            </DialogDescription>
          </DialogHeader>

          {editError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          ) : null}

          {editLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input {...form.register("name")} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Código</Label>
                  <Input {...form.register("code")} />
                </div>
                <div className="grid gap-2">
                  <Label>NIT</Label>
                  <Input {...form.register("taxNumber")} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Dirección</Label>
                <Input {...form.register("address")} />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Ciudad</Label>
                  <Input {...form.register("city")} />
                </div>
                <div className="grid gap-2">
                  <Label>Código postal</Label>
                  <Input {...form.register("postalCode")} />
                </div>
                <div className="grid gap-2">
                  <Label>País</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.watch("countryId") ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      form.setValue("countryId", v ? Number(v) : undefined);
                    }}
                  >
                    <option value="">(Sin país)</option>
                    {countryOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input {...form.register("email")} />
                </div>
                <div className="grid gap-2">
                  <Label>Teléfono</Label>
                  <Input {...form.register("phoneNumber")} />
                </div>
                <div className="grid gap-2">
                  <Label>Días vencimiento</Label>
                  <Input
                    type="number"
                    value={form.watch("dueDatePeriod") ?? 0}
                    onChange={(e) => form.setValue("dueDatePeriod", Number(e.target.value || 0))}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(form.watch("isEnabled"))}
                    onCheckedChange={(v) => form.setValue("isEnabled", Boolean(v))}
                  />
                  Activo
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(form.watch("isSupplier"))}
                    onCheckedChange={(v) => form.setValue("isSupplier", Boolean(v))}
                  />
                  Proveedor
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(form.watch("isCustomer"))}
                    onCheckedChange={(v) => form.setValue("isCustomer", Boolean(v))}
                  />
                  Cliente
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(form.watch("isTaxExempt"))}
                    onCheckedChange={(v) => form.setValue("isTaxExempt", Boolean(v))}
                  />
                  Exento IVA
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={editLoading}>
                  {editLoading ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
