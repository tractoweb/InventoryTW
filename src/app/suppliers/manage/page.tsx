"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { getCreditSummaryAction, type CreditPartyRow } from "@/actions/get-credit-summary";
import { getCreditPartyDetailsAction, type CreditPartyDetails } from "@/actions/get-credit-party-details";
import { updateDocumentPaidStatusAction } from "@/actions/update-document-paid-status";

import { PaymentReminderDialog, type PaymentReminderDialogInput } from "@/components/finance/payment-reminder-dialog";

const SupplierFormSchema = z.object({
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
});

type SupplierFormValues = z.infer<typeof SupplierFormSchema>;

export default function SuppliersManagePage() {
  const { toast } = useToast();

  const searchParams = useSearchParams();
  const didInitFromQuery = React.useRef(false);

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);

  React.useEffect(() => {
    if (didInitFromQuery.current) return;
    const qp = searchParams?.get("q");
    if (qp && String(qp).trim()) setQ(String(qp));
    didInitFromQuery.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [onlyEnabled, setOnlyEnabled] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<CustomerSearchResult[]>([]);

  const [countries, setCountries] = React.useState<CountryListItem[]>([]);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const [payablesLoading, setPayablesLoading] = React.useState(false);
  const [payablesError, setPayablesError] = React.useState<string | null>(null);
  const [payablesRows, setPayablesRows] = React.useState<CreditPartyRow[]>([]);

  const [payablesDetailsOpen, setPayablesDetailsOpen] = React.useState(false);
  const [payablesDetailsLoading, setPayablesDetailsLoading] = React.useState(false);
  const [payablesDetailsError, setPayablesDetailsError] = React.useState<string | null>(null);
  const [payablesDetails, setPayablesDetails] = React.useState<CreditPartyDetails | null>(null);
  const [markingPaidDocId, setMarkingPaidDocId] = React.useState<number | null>(null);
  const [sendingReminderKey, setSendingReminderKey] = React.useState<string | null>(null);

  const [reminderDialogOpen, setReminderDialogOpen] = React.useState(false);
  const [reminderDialogInput, setReminderDialogInput] = React.useState<PaymentReminderDialogInput | null>(null);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(SupplierFormSchema),
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
    },
  });

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await searchCustomersAction(dq, 100, {
        onlyEnabled,
        onlySuppliers: true,
      });
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar proveedores");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, onlyEnabled]);

  React.useEffect(() => {
    getCountries()
      .then((r) => {
        if (!r.error) setCountries(r.data ?? []);
      })
      .catch(() => {});
  }, []);

  async function refreshPayables() {
    setPayablesLoading(true);
    setPayablesError(null);
    try {
      const res = await getCreditSummaryAction(365);
      if (res?.error) throw new Error(res.error);
      setPayablesRows(res?.data?.suppliers ?? []);
    } catch (e: any) {
      setPayablesError(e?.message ?? "No se pudo cargar por pagar");
      setPayablesRows([]);
    } finally {
      setPayablesLoading(false);
    }
  }

  React.useEffect(() => {
    refreshPayables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payablesFiltered = React.useMemo(() => {
    const key = String(dq ?? "").trim().toLowerCase();
    const base = payablesRows ?? [];
    if (!key) return base.slice(0, 20);
    return base
      .filter((r) => String(r?.name ?? "").toLowerCase().includes(key) || String(r?.email ?? "").toLowerCase().includes(key))
      .slice(0, 20);
  }, [payablesRows, dq]);

  function formatMoney(value: unknown): string {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
  }

  async function openPayablesDetails(partyKey: string) {
    setPayablesDetailsOpen(true);
    setPayablesDetailsLoading(true);
    setPayablesDetailsError(null);
    setPayablesDetails(null);
    try {
      const res = await getCreditPartyDetailsAction({ kind: "supplier", partyKey, daysWindow: 365 });
      if (res?.error) throw new Error(res.error);
      if (!res?.data) throw new Error("No se pudo cargar documentos");
      setPayablesDetails(res.data);
    } catch (e: any) {
      setPayablesDetailsError(e?.message ?? "No se pudo cargar documentos");
    } finally {
      setPayablesDetailsLoading(false);
    }
  }

  async function refreshPayablesDetails() {
    if (!payablesDetails?.partyKey) return;
    setPayablesDetailsLoading(true);
    setPayablesDetailsError(null);
    try {
      const res = await getCreditPartyDetailsAction({ kind: "supplier", partyKey: payablesDetails.partyKey, daysWindow: 365 });
      if (res?.error) throw new Error(res.error);
      if (!res?.data) throw new Error("No se pudo cargar documentos");
      setPayablesDetails(res.data);
    } catch (e: any) {
      setPayablesDetailsError(e?.message ?? "No se pudo cargar documentos");
    } finally {
      setPayablesDetailsLoading(false);
    }
  }

  async function markDocPaid(documentId: number) {
    if (!Number.isFinite(Number(documentId)) || Number(documentId) <= 0) return;
    if (markingPaidDocId) return;
    setMarkingPaidDocId(Number(documentId));
    try {
      const res = await updateDocumentPaidStatusAction({ documentId: Number(documentId), paidStatus: 2 });
      if (!res?.success) throw new Error(res?.error ?? "No se pudo marcar como pagada");
      toast({ title: "Pagada", description: `Documento ${documentId} marcado como pagado.` });
      await refreshPayables();
      await refreshPayablesDetails();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo marcar como pagada" });
    } finally {
      setMarkingPaidDocId(null);
    }
  }

  function sendReminderEmail(input: { partyKey: string; name: string; email?: string | null; docs: any[] }) {
    const to = String(input.email ?? "").trim();
    if (!to) {
      toast({ variant: "destructive", title: "Falta email", description: "Este proveedor no tiene email para enviar." });
      return;
    }
    if (sendingReminderKey) return;
    setSendingReminderKey(input.partyKey);

    const docs = (input.docs ?? []).map((d: any) => ({
      documentId: Number(d.documentId),
      number: String(d.number ?? ""),
      pendingApprox: Number(d.pendingApprox ?? 0),
      dueDate: d.dueDate ?? null,
      daysOverdue: Number(d.daysOverdue ?? 0),
    }));

    setReminderDialogInput({
      kind: "supplier",
      partyName: String(input.name ?? "").trim() || "Proveedor",
      to,
      docs,
    });
    setReminderDialogOpen(true);
  }

  function buildSummaryText(details: CreditPartyDetails): string {
    const lines = (details.docs ?? [])
      .slice(0, 20)
      .map((d) => {
        const due = d.dueDate ? ` (vence ${d.dueDate})` : "";
        const ov = d.daysOverdue > 0 ? ` · ${d.daysOverdue} día(s) vencido` : "";
        return `- Doc ${d.number}: Pendiente ${formatMoney(d.pendingApprox)}${due}${ov}`;
      })
      .join("\n");
    return `Proveedor: ${details.name}\nPendiente aprox: ${formatMoney(details.pendingApprox)}\nVencido aprox: ${formatMoney(details.overdueApprox)}\n\nDocumentos:\n${lines}`;
  }

  async function openEdit(idCustomer: number) {
    setEditOpen(true);
    setEditLoading(true);
    setEditError(null);
    setEditingId(idCustomer);

    try {
      const res = await getCustomerDetails(idCustomer);
      if (res.error) throw new Error(res.error);
      const c = res.data;
      if (!c) throw new Error("No se pudo cargar el proveedor");

      form.reset({
        idCustomer: Number(c.idCustomer),
        name: String(c.name ?? ""),
        code: c.code ?? "",
        taxNumber: c.taxNumber ?? "",
        address: c.address ?? "",
        postalCode: c.postalCode ?? "",
        city: c.city ?? "",
        countryId: c.countryId ? Number(c.countryId) : undefined,
        email: c.email ?? "",
        phoneNumber: c.phoneNumber ?? "",
        dueDatePeriod: Number(c.dueDatePeriod ?? 0),
        isTaxExempt: Boolean(c.isTaxExempt ?? false),
        isEnabled: c.isEnabled !== false,
      });
    } catch (e: any) {
      setEditError(e?.message ?? "No se pudo cargar el proveedor");
    } finally {
      setEditLoading(false);
    }
  }

  async function onSubmit(values: SupplierFormValues) {
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await updateCustomerAction({
        idCustomer: values.idCustomer,
        name: values.name,
        code: values.code,
        taxNumber: values.taxNumber,
        address: values.address,
        postalCode: values.postalCode,
        city: values.city,
        countryId: values.countryId,
        email: values.email,
        phoneNumber: values.phoneNumber,
        dueDatePeriod: values.dueDatePeriod,
        isTaxExempt: values.isTaxExempt,
        isEnabled: values.isEnabled,
        isSupplier: true,
        isCustomer: false,
      });

      if (!res.success) throw new Error(res.error ?? "No se pudo actualizar");

      toast({
        title: "Proveedor actualizado",
        description: `ID ${values.idCustomer} · ${values.name}`,
      });

      setEditOpen(false);
      setEditingId(null);
      refresh();
    } catch (e: any) {
      setEditError(e?.message ?? "No se pudo actualizar el proveedor");
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PaymentReminderDialog
        open={reminderDialogOpen}
        onOpenChange={(open) => {
          setReminderDialogOpen(open);
          if (!open) {
            setReminderDialogInput(null);
            setSendingReminderKey(null);
          }
        }}
        input={reminderDialogInput}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-muted-foreground">Gestión de proveedores (modelo Customer).</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/suppliers">Volver</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Por pagar</CardTitle>
          <Button variant="outline" onClick={refreshPayables} disabled={payablesLoading}>
            {payablesLoading ? "Actualizando…" : "Actualizar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {payablesError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{payablesError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Vencido</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payablesLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="text-sm text-muted-foreground">Cargando por pagar…</div>
                    </TableCell>
                  </TableRow>
                ) : payablesFiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="text-sm text-muted-foreground">Sin saldos pendientes en la ventana.</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  payablesFiltered.map((r) => (
                    <TableRow key={r.partyKey}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.email ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.pendingApprox)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.overdueApprox)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!r.email || Boolean(sendingReminderKey)}
                            onClick={() => sendReminderEmail({ partyKey: r.partyKey, name: r.name, email: r.email, docs: r.docs ?? [] })}
                          >
                            {sendingReminderKey === r.partyKey ? "Enviando…" : "Enviar"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => openPayablesDetails(r.partyKey)}>
                            Ver docs
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={payablesDetailsOpen} onOpenChange={setPayablesDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Documentos por pagar</DialogTitle>
            <DialogDescription>
              {payablesDetails?.name ? `${payablesDetails.name}` : "Detalle de documentos pendientes."}
            </DialogDescription>
          </DialogHeader>

          {payablesDetailsError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{payablesDetailsError}</AlertDescription>
            </Alert>
          ) : null}

          {payablesDetailsLoading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : payablesDetails ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  disabled={!payablesDetails?.email || Boolean(sendingReminderKey)}
                  onClick={() =>
                    sendReminderEmail({
                      partyKey: payablesDetails.partyKey,
                      name: payablesDetails.name,
                      email: payablesDetails.email,
                      docs: payablesDetails.docs ?? [],
                    })
                  }
                >
                  {sendingReminderKey === payablesDetails.partyKey ? "Enviando…" : "Enviar email"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const text = buildSummaryText(payablesDetails);
                      await navigator.clipboard.writeText(text);
                      toast({ title: "Copiado", description: "Resumen copiado al portapapeles." });
                    } catch (e: any) {
                      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo copiar" });
                    }
                  }}
                >
                  Copiar resumen
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Pendiente aprox</div>
                  <div className="text-lg font-semibold tabular-nums">{formatMoney(payablesDetails.pendingApprox)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Vencido aprox</div>
                  <div className="text-lg font-semibold tabular-nums">{formatMoney(payablesDetails.overdueApprox)}</div>
                </div>
              </div>

              <div className="rounded-md border max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right">Días</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payablesDetails.docs ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="text-sm text-muted-foreground">Sin documentos.</div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (payablesDetails.docs ?? []).map((d) => (
                        <TableRow key={String(d.documentId)}>
                          <TableCell className="font-medium">{d.number}</TableCell>
                          <TableCell>{d.date || "—"}</TableCell>
                          <TableCell>{d.dueDate || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.daysOverdue > 0 ? d.daysOverdue : 0}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(d.pendingApprox)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => markDocPaid(d.documentId)}
                                disabled={payablesDetailsLoading || Boolean(markingPaidDocId)}
                              >
                                {markingPaidDocId === d.documentId ? "Marcando…" : "Pagada"}
                              </Button>
                              <Button asChild type="button" variant="outline" size="sm">
                                <Link href={d.href}>PDF</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sin datos.</div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Buscar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>Nombre / Código / NIT</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proveedor…" />
            </div>
            <div>
              <Label>Estado</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={onlyEnabled ? "default" : "outline"}
                  onClick={() => setOnlyEnabled((v) => !v)}
                >
                  Solo activos
                </Button>
              </div>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">NIT</TableHead>
                    <TableHead className="hidden md:table-cell">Ciudad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Sin resultados
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.idCustomer}>
                        <TableCell>{r.idCustomer}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.taxNumber ?? "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.city ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openEdit(r.idCustomer)}>
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(v) => setEditOpen(v)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
            <DialogDescription>{editingId ? `ID ${editingId}` : ""}</DialogDescription>
          </DialogHeader>

          {editError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          ) : null}

          {editLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label>Nombre</Label>
                  <Input {...form.register("name")} />
                </div>
                <div>
                  <Label>Código</Label>
                  <Input {...form.register("code")} />
                </div>
                <div>
                  <Label>NIT/CC</Label>
                  <Input {...form.register("taxNumber")} />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input {...form.register("phoneNumber")} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input {...form.register("email")} />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input {...form.register("city")} />
                </div>
                <div className="md:col-span-2">
                  <Label>Dirección</Label>
                  <Input {...form.register("address")} />
                </div>
                <div>
                  <Label>Código postal</Label>
                  <Input {...form.register("postalCode")} />
                </div>
                <div>
                  <Label>País</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.watch("countryId") ?? ""}
                    onChange={(e) => form.setValue("countryId", e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <option value="">(Opcional)</option>
                    {countries.map((c) => (
                      <option key={c.idCountry} value={c.idCountry}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Días vencimiento</Label>
                  <Input type="number" {...form.register("dueDatePeriod", { valueAsNumber: true })} />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
