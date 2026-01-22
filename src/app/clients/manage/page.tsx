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

import { searchClientsAction, type ClientSearchResult } from "@/actions/search-clients";
import { getClientDetails } from "@/actions/get-client-details";
import { updateClientAction } from "@/actions/update-client";
import { createClientAction } from "@/actions/create-client";
import { getCreditSummaryAction, type CreditPartyRow } from "@/actions/get-credit-summary";
import { getCreditPartyDetailsAction, type CreditPartyDetails } from "@/actions/get-credit-party-details";
import { updateDocumentPaidStatusAction } from "@/actions/update-document-paid-status";
import { importClientsFromCreditSummaryAction } from "@/actions/import-clients-from-credit-summary";
import { createAndLinkClientFromCreditAction } from "@/actions/create-and-link-client-from-credit";

import { PaymentReminderDialog, type PaymentReminderDialogInput } from "@/components/finance/payment-reminder-dialog";

const ClientFormSchema = z.object({
  idClient: z.number().int().min(1),
  name: z.string().min(1, "Nombre requerido"),
  taxNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  isEnabled: z.boolean().optional(),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof ClientFormSchema>;

const NewClientSchema = ClientFormSchema.omit({ idClient: true });
type NewClientValues = z.infer<typeof NewClientSchema>;

export default function ClientsManagePage() {
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
  const [rows, setRows] = React.useState<ClientSearchResult[]>([]);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const [creditLoading, setCreditLoading] = React.useState(false);
  const [creditError, setCreditError] = React.useState<string | null>(null);
  const [creditRows, setCreditRows] = React.useState<CreditPartyRow[]>([]);

  const [creditDetailsOpen, setCreditDetailsOpen] = React.useState(false);
  const [creditDetailsLoading, setCreditDetailsLoading] = React.useState(false);
  const [creditDetailsError, setCreditDetailsError] = React.useState<string | null>(null);
  const [creditDetails, setCreditDetails] = React.useState<CreditPartyDetails | null>(null);
  const [markingPaidDocId, setMarkingPaidDocId] = React.useState<number | null>(null);
  const [sendingReminderKey, setSendingReminderKey] = React.useState<string | null>(null);
  const [importingClients, setImportingClients] = React.useState(false);
  const [creatingClientFromCredit, setCreatingClientFromCredit] = React.useState(false);

  const [reminderDialogOpen, setReminderDialogOpen] = React.useState(false);
  const [reminderDialogInput, setReminderDialogInput] = React.useState<PaymentReminderDialogInput | null>(null);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(ClientFormSchema),
    defaultValues: {
      idClient: 0,
      name: "",
      taxNumber: "",
      phoneNumber: "",
      email: "",
      address: "",
      city: "",
      isEnabled: true,
      notes: "",
    },
  });

  const createForm = useForm<NewClientValues>({
    resolver: zodResolver(NewClientSchema),
    defaultValues: {
      name: "",
      taxNumber: "",
      phoneNumber: "",
      email: "",
      address: "",
      city: "",
      isEnabled: true,
      notes: "",
    },
  });

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await searchClientsAction(dq, 100, { onlyEnabled });
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar clientes");
    } finally {
      setLoading(false);
    }
  }

  async function importClientsFromCredit() {
    if (importingClients) return;
    setImportingClients(true);
    try {
      const res = await importClientsFromCreditSummaryAction({ daysWindow: 365, maxClients: 50 });
      if (!res?.success) throw new Error(res?.error ?? "No se pudo importar clientes");
      toast({
        title: "Importación completa",
        description: `Creados: ${res.created} · Docs vinculados: ${res.linkedDocs} · Omitidos: ${res.skipped}`,
      });
      await refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo importar" });
    } finally {
      setImportingClients(false);
    }
  }

  async function createClientFromCreditDetails() {
    if (!creditDetails) return;
    if (creatingClientFromCredit) return;
    if (!String(creditDetails.partyKey ?? "").startsWith("clientname:")) return;

    setCreatingClientFromCredit(true);
    try {
      const docIds = (creditDetails.docs ?? []).map((d) => Number(d.documentId)).filter((n) => Number.isFinite(n) && n > 0);
      const res = await createAndLinkClientFromCreditAction({
        name: String(creditDetails.name ?? "").trim() || "Cliente",
        email: creditDetails.email ?? null,
        documentIds: docIds,
      });
      if (!res?.success) throw new Error(res?.error ?? "No se pudo crear/vincular el cliente");

      toast({
        title: "Cliente creado",
        description: `ID ${res.idClient} · Docs vinculados: ${res.linkedDocs ?? 0}`,
      });

      await refreshCredit();
      await refreshCreditDetails();
      await refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo crear/vincular" });
    } finally {
      setCreatingClientFromCredit(false);
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, onlyEnabled]);

  async function refreshCredit() {
    setCreditLoading(true);
    setCreditError(null);
    try {
      const res = await getCreditSummaryAction(365);
      if (res?.error) throw new Error(res.error);
      setCreditRows(res?.data?.clients ?? []);
    } catch (e: any) {
      setCreditError(e?.message ?? "No se pudo cargar cartera");
      setCreditRows([]);
    } finally {
      setCreditLoading(false);
    }
  }

  React.useEffect(() => {
    refreshCredit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const creditFiltered = React.useMemo(() => {
    const key = String(dq ?? "").trim().toLowerCase();
    const base = creditRows ?? [];
    if (!key) return base.slice(0, 20);
    return base
      .filter((r) => String(r?.name ?? "").toLowerCase().includes(key) || String(r?.email ?? "").toLowerCase().includes(key))
      .slice(0, 20);
  }, [creditRows, dq]);

  function formatMoney(value: unknown): string {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
  }

  function buildReminderMailto(row: CreditPartyRow): string | null {
    const to = String(row?.email ?? "").trim();
    if (!to) return null;

    const cc = "tractobodegaweb@gmail.com";
    const subject = `Recordatorio de pago · ${row.name}`;
    const lines = (row.docs ?? [])
      .slice(0, 6)
      .map((d) => {
        const due = d.dueDate ? ` (vence ${d.dueDate})` : "";
        const ov = d.daysOverdue > 0 ? ` · ${d.daysOverdue} día(s) vencido` : "";
        return `- Doc ${d.number}: Pendiente ${formatMoney(d.pendingApprox)}${due}${ov}`;
      })
      .join("\n");

    const body = `Buen día,\n\nTe recordamos el saldo pendiente.\n\nPendiente total aprox: ${formatMoney(row.pendingApprox)}\nVencido aprox: ${formatMoney(row.overdueApprox)}\n\nDocumentos:\n${lines}\n\nGracias.`;

    const query = [
      ["cc", cc],
      ["subject", subject],
      ["body", body],
    ]
      .filter(([, v]) => String(v ?? "").trim().length > 0)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    return `mailto:${encodeURIComponent(to)}?${query}`;
  }

  async function openCreditDetails(partyKey: string) {
    setCreditDetailsOpen(true);
    setCreditDetailsLoading(true);
    setCreditDetailsError(null);
    setCreditDetails(null);
    try {
      const res = await getCreditPartyDetailsAction({ kind: "client", partyKey, daysWindow: 365 });
      if (res?.error) throw new Error(res.error);
      if (!res?.data) throw new Error("No se pudo cargar documentos");
      setCreditDetails(res.data);
    } catch (e: any) {
      setCreditDetailsError(e?.message ?? "No se pudo cargar documentos");
    } finally {
      setCreditDetailsLoading(false);
    }
  }

  async function refreshCreditDetails() {
    if (!creditDetails?.partyKey) return;
    setCreditDetailsLoading(true);
    setCreditDetailsError(null);
    try {
      const res = await getCreditPartyDetailsAction({ kind: "client", partyKey: creditDetails.partyKey, daysWindow: 365 });
      if (res?.error) throw new Error(res.error);
      if (!res?.data) throw new Error("No se pudo cargar documentos");
      setCreditDetails(res.data);
    } catch (e: any) {
      setCreditDetailsError(e?.message ?? "No se pudo cargar documentos");
    } finally {
      setCreditDetailsLoading(false);
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
      await refreshCredit();
      await refreshCreditDetails();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo marcar como pagada" });
    } finally {
      setMarkingPaidDocId(null);
    }
  }

  function buildReminderMailtoFromDetails(details: CreditPartyDetails): string | null {
    const to = String(details?.email ?? "").trim();
    if (!to) return null;
    const cc = "tractobodegaweb@gmail.com";
    const subject = `Recordatorio de pago · ${details.name}`;
    const lines = (details.docs ?? [])
      .slice(0, 12)
      .map((d) => {
        const due = d.dueDate ? ` (vence ${d.dueDate})` : "";
        const ov = d.daysOverdue > 0 ? ` · ${d.daysOverdue} día(s) vencido` : "";
        return `- Doc ${d.number}: Pendiente ${formatMoney(d.pendingApprox)}${due}${ov}`;
      })
      .join("\n");

    const body = `Buen día,\n\nTe recordamos el saldo pendiente.\n\nPendiente total aprox: ${formatMoney(details.pendingApprox)}\nVencido aprox: ${formatMoney(details.overdueApprox)}\n\nDocumentos:\n${lines}\n\nGracias.`;

    const query = [
      ["cc", cc],
      ["subject", subject],
      ["body", body],
    ]
      .filter(([, v]) => String(v ?? "").trim().length > 0)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    return `mailto:${encodeURIComponent(to)}?${query}`;
  }

  function sendReminderEmail(input: { partyKey: string; name: string; email?: string | null; docs: any[] }) {
    const to = String(input.email ?? "").trim();
    if (!to) {
      toast({ variant: "destructive", title: "Falta email", description: "Este cliente no tiene email para enviar." });
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
      kind: "client",
      partyName: String(input.name ?? "").trim() || "Cliente",
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
    return `Cliente: ${details.name}\nPendiente aprox: ${formatMoney(details.pendingApprox)}\nVencido aprox: ${formatMoney(details.overdueApprox)}\n\nDocumentos:\n${lines}`;
  }

  async function openEdit(idClient: number) {
    setEditOpen(true);
    setEditLoading(true);
    setEditError(null);
    setEditingId(idClient);

    try {
      const res = await getClientDetails(idClient);
      if (res.error) throw new Error(res.error);
      const c = res.data;
      if (!c) throw new Error("No se pudo cargar el cliente");

      form.reset({
        idClient: Number(c.idClient),
        name: String(c.name ?? ""),
        taxNumber: c.taxNumber ?? "",
        phoneNumber: c.phoneNumber ?? "",
        email: c.email ?? "",
        address: c.address ?? "",
        city: c.city ?? "",
        isEnabled: c.isEnabled !== false,
        notes: c.notes ?? "",
      });
    } catch (e: any) {
      setEditError(e?.message ?? "No se pudo cargar el cliente");
    } finally {
      setEditLoading(false);
    }
  }

  async function onSubmit(values: ClientFormValues) {
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await updateClientAction(values);
      if (!res.success) throw new Error(res.error ?? "No se pudo actualizar");

      toast({
        title: "Cliente actualizado",
        description: `ID ${values.idClient} · ${values.name}`,
      });

      setEditOpen(false);
      setEditingId(null);
      refresh();
    } catch (e: any) {
      setEditError(e?.message ?? "No se pudo actualizar el cliente");
    } finally {
      setEditLoading(false);
    }
  }

  async function onCreate(values: NewClientValues) {
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await createClientAction(values);
      if (!res.success) throw new Error(res.error ?? "No se pudo crear");

      toast({
        title: "Cliente creado",
        description: `ID ${res.idClient} · ${values.name}`,
      });

      setCreateOpen(false);
      createForm.reset();
      refresh();
    } catch (e: any) {
      setCreateError(e?.message ?? "No se pudo crear el cliente");
    } finally {
      setCreateLoading(false);
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
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Clientes de venta (tabla Client).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            Nuevo
          </Button>
          <Button asChild variant="outline">
            <Link href="/clients">Volver</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Cartera (por cobrar)</CardTitle>
          <Button variant="outline" onClick={refreshCredit} disabled={creditLoading}>
            {creditLoading ? "Actualizando…" : "Actualizar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && creditRows.length > 0 ? (
            <Alert>
              <AlertTitle>Clientes no aparecen en “Buscar”</AlertTitle>
              <AlertDescription>
                La cartera se calcula desde Documentos (snapshots), pero la tabla <strong>Client</strong> parece vacía. Puedes crear clientes
                automáticamente desde la cartera para que aparezcan en el buscador y se vinculen a documentos.
                <div className="mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={importClientsFromCredit} disabled={importingClients}>
                    {importingClients ? "Importando…" : "Crear clientes desde cartera"}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
          {creditError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{creditError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Vencido</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="text-sm text-muted-foreground">Cargando cartera…</div>
                    </TableCell>
                  </TableRow>
                ) : creditFiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="text-sm text-muted-foreground">Sin saldos pendientes en la ventana.</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  creditFiltered.map((r) => {
                    const mailto = buildReminderMailto(r);
                    return (
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
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!mailto}
                              onClick={() => {
                                if (!mailto) return;
                                window.location.href = mailto;
                              }}
                            >
                              Recordar
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => openCreditDetails(r.partyKey)}>
                              Docs/Pago
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {creditFiltered.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              Tip: usa la búsqueda para filtrar por nombre/email; “Recordar” abre tu cliente de correo con CC. En “Docs/Pago” puedes marcar documentos como pagados.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={creditDetailsOpen} onOpenChange={setCreditDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Documentos por cobrar</DialogTitle>
            <DialogDescription>
              {creditDetails?.name ? `${creditDetails.name}` : "Detalle de documentos pendientes."}
            </DialogDescription>
          </DialogHeader>

          {creditDetailsError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{creditDetailsError}</AlertDescription>
            </Alert>
          ) : null}

          {creditDetailsLoading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : creditDetails ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {String(creditDetails.partyKey ?? "").startsWith("clientname:") ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={createClientFromCreditDetails}
                    disabled={creatingClientFromCredit || creditDetailsLoading}
                    title="Crea un registro en Client y vincula estos documentos para trazabilidad"
                  >
                    {creatingClientFromCredit ? "Creando…" : "Crear cliente (trazabilidad)"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  disabled={!creditDetails?.email || Boolean(sendingReminderKey)}
                  onClick={() =>
                    sendReminderEmail({
                      partyKey: creditDetails.partyKey,
                      name: creditDetails.name,
                      email: creditDetails.email,
                      docs: creditDetails.docs ?? [],
                    })
                  }
                >
                  {sendingReminderKey === creditDetails.partyKey ? "Enviando…" : "Enviar email"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const text = buildSummaryText(creditDetails);
                      await navigator.clipboard.writeText(text);
                      toast({ title: "Copiado", description: "Resumen copiado al portapapeles." });
                    } catch (e: any) {
                      toast({ variant: "destructive", title: "Error", description: e?.message ?? "No se pudo copiar" });
                    }
                  }}
                >
                  Copiar resumen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!buildReminderMailtoFromDetails(creditDetails)}
                  onClick={() => {
                    const mailto = buildReminderMailtoFromDetails(creditDetails);
                    if (!mailto) return;
                    window.location.href = mailto;
                  }}
                >
                  Recordar
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Pendiente aprox</div>
                  <div className="text-lg font-semibold tabular-nums">{formatMoney(creditDetails.pendingApprox)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Vencido aprox</div>
                  <div className="text-lg font-semibold tabular-nums">{formatMoney(creditDetails.overdueApprox)}</div>
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
                    {(creditDetails.docs ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="text-sm text-muted-foreground">Sin documentos.</div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (creditDetails.docs ?? []).map((d) => (
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
                                disabled={creditDetailsLoading || Boolean(markingPaidDocId)}
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
              <Label>Nombre / NIT / Teléfono / Email</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" />
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
                    <TableHead className="hidden md:table-cell">Teléfono</TableHead>
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
                      <TableRow key={r.idClient}>
                        <TableCell>{r.idClient}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.taxNumber ?? "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.phoneNumber ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openEdit(r.idClient)}>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Datos básicos para ventas.</DialogDescription>
          </DialogHeader>

          {createError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          ) : null}

          {createLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={createForm.handleSubmit(onCreate)}>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label>Nombre</Label>
                  <Input {...createForm.register("name")} />
                </div>
                <div>
                  <Label>NIT/CC</Label>
                  <Input {...createForm.register("taxNumber")} />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input {...createForm.register("phoneNumber")} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input {...createForm.register("email")} />
                </div>
                <div className="md:col-span-2">
                  <Label>Dirección</Label>
                  <Input {...createForm.register("address")} />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input {...createForm.register("city")} />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Input {...createForm.register("notes")} />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Crear</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(v) => setEditOpen(v)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
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
                <div className="md:col-span-2">
                  <Label>Dirección</Label>
                  <Input {...form.register("address")} />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input {...form.register("city")} />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Input {...form.register("notes")} />
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
