"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

import { listAuditLogsAction, type AuditLogRow } from "@/actions/list-audit-logs";
import { listUsersAction, type UserListRow } from "@/actions/list-users";

import { RefreshCw, X } from "lucide-react";

const ACTION_OPTIONS = [
  "all",
  "CREATE",
  "UPDATE",
  "DELETE",
  "SOFT_DELETE",
  "HARD_DELETE",
  "CLOCK_OUT",
] as const;

const TABLE_OPTIONS = [
  "all",
  "Product",
  "Customer",
  "Warehouse",
  "Tax",
  "PaymentType",
  "User",
  "Company",
  "ApplicationSettings",
  "Document",
  "Stock",
  "Kardex",
] as const;

const MODULE_LABELS: Record<string, string> = {
  Product: "Productos",
  Customer: "Clientes/Proveedores",
  Warehouse: "Almacenes",
  Tax: "Impuestos",
  PaymentType: "Tipos de pago",
  User: "Usuarios",
  Company: "Empresa",
  ApplicationSettings: "Configuración",
  Document: "Documentos",
  Stock: "Stock",
  Kardex: "Kardex",
};

const IGNORED_CHANGED_FIELDS = new Set<string>([
  "createdAt",
  "updatedAt",
  "timestamp",
  "logId",
  "lastModifiedBy",
  "lastModifiedDate",
  "sessionToken",
]);

const FIELD_LABELS_BY_TABLE: Record<string, Record<string, string>> = {
  Product: {
    name: "Nombre",
    code: "Código",
    price: "Precio",
    cost: "Costo",
    markup: "Margen",
    isEnabled: "Estado",
    isService: "Tipo",
    isTaxInclusivePrice: "IVA incluido",
    currencyId: "Moneda",
    productGroupId: "Grupo",
    barcodes: "Códigos de barras",
    taxIds: "Impuestos",
  },
  Customer: {
    name: "Nombre",
    code: "Código",
    taxNumber: "NIT",
    email: "Email",
    phoneNumber: "Teléfono",
    address: "Dirección",
    city: "Ciudad",
    countryId: "País",
    isEnabled: "Estado",
    isCustomer: "Cliente",
    isSupplier: "Proveedor",
    dueDatePeriod: "Plazo",
    isTaxExempt: "Exento IVA",
  },
  Warehouse: {
    name: "Nombre",
  },
  Tax: {
    name: "Nombre",
    percentage: "Porcentaje",
    isEnabled: "Estado",
  },
  PaymentType: {
    name: "Nombre",
    isEnabled: "Estado",
  },
  User: {
    username: "Usuario",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Email",
    accessLevel: "Rol",
    isEnabled: "Estado",
  },
  Company: {
    name: "Nombre",
    taxNumber: "NIT",
    email: "Email",
    phoneNumber: "Teléfono",
  },
  ApplicationSettings: {
    organizationName: "Organización",
    primaryColor: "Color",
    currencySymbol: "Moneda",
    dateFormat: "Formato fecha",
    timeFormat: "Formato hora",
    taxPercentage: "IVA",
    allowNegativeStock: "Stock negativo",
    defaultWarehouseId: "Almacén por defecto",
  },
  Document: {
    number: "Número",
    customerId: "Cliente",
    warehouseId: "Almacén",
    total: "Total",
    isClockedOut: "Finalizado",
    documentTypeId: "Tipo",
    stockDate: "Fecha stock",
  },
};

function pickHref(tableName: string, recordId: number): string | null {
  const table = String(tableName ?? "");
  const id = Number(recordId);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (table === "Document") return `/documents/${id}/pdf`;
  if (table === "Product") return `/inventory/${id}`;
  if (table === "Warehouse") return `/warehouses`;
  if (table === "Customer") return `/partners`;
  if (table === "Tax") return `/settings/taxes`;
  if (table === "PaymentType") return `/settings/payment-types`;
  if (table === "User") return `/settings/users`;
  if (table === "Company") return `/company`;
  if (table === "ApplicationSettings") return `/settings`;
  return null;
}

function ActionBadge({ action }: { action: string }) {
  const a = String(action ?? "").toUpperCase();
  const cls =
    a === "CREATE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : a === "UPDATE"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : a === "DELETE" || a === "HARD_DELETE" || a === "SOFT_DELETE"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-muted bg-muted/30 text-foreground";
  return (
    <Badge variant="outline" className={cls}>
      {a || "ACT"}
    </Badge>
  );
}

function fmtDateTime(ts: string): { date: string; time: string } {
  const d = new Date(String(ts ?? ""));
  if (!Number.isFinite(d.getTime())) return { date: String(ts ?? ""), time: "" };
  const date = d.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
  const time = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return { date, time };
}

type SortKey = "timestamp" | "action" | "tableName" | "record" | "user" | "changes";
type SortDir = "asc" | "desc";

function sortIndicator(active: boolean, dir: SortDir): string {
  if (!active) return "";
  return dir === "asc" ? " ▲" : " ▼";
}

function compareNullable(a: string | null | undefined, b: string | null | undefined): number {
  return String(a ?? "").localeCompare(String(b ?? ""), "es", { sensitivity: "base" });
}

function summarizeChange(row: AuditLogRow): string {
  const action = String(row.action ?? "").toUpperCase();
  const table = String(row.tableName ?? "");
  const moduleLabel = (MODULE_LABELS[table] ?? table) || "Módulo";

  if (action === "CREATE") return `${moduleLabel}: creado`;
  if (action === "DELETE" || action === "HARD_DELETE" || action === "SOFT_DELETE") return `${moduleLabel}: eliminado`;

  if (action === "UPDATE") {
    const changed = Array.isArray(row.changedFields) ? row.changedFields : [];
    const filtered = changed
      .map((k) => String(k))
      .filter((k) => k && !IGNORED_CHANGED_FIELDS.has(k) && !/^(id|_)/i.test(k));

    const labelsMap = FIELD_LABELS_BY_TABLE[table] ?? {};
    const labels = filtered
      .map((k) => labelsMap[k] ?? k)
      .filter((s) => String(s).trim().length > 0)
      .slice(0, 3);

    if (labels.length === 0) return `${moduleLabel}: actualizado`;
    return `${moduleLabel}: actualizado (${labels.join(", ")}${filtered.length > 3 ? "…" : ""})`;
  }

  return `${moduleLabel}: ${action || "evento"}`;
}

function friendlyChangedLabels(row: AuditLogRow, max = 8): string[] {
  const table = String(row.tableName ?? "");
  const changed = Array.isArray(row.changedFields) ? row.changedFields : [];
  const labelsMap = FIELD_LABELS_BY_TABLE[table] ?? {};

  const filtered = changed
    .map((k) => String(k))
    .filter((k) => k && !IGNORED_CHANGED_FIELDS.has(k) && !/^(id|_)/i.test(k));

  const labels = filtered
    .map((k) => labelsMap[k] ?? k)
    .filter((s) => String(s).trim().length > 0);

  const unique = Array.from(new Set(labels));
  return unique.slice(0, Math.max(1, max));
}

function toIsoDate(value: string) {
  if (!value) return "";
  return String(value).split("T")[0];
}

function prettyJson(raw: string | null): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return trimmed;
  }
}

export default function AuditClientPage() {
  const { toast } = useToast();

  const [rows, setRows] = React.useState<AuditLogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);

  const [userId, setUserId] = React.useState<string>("all");
  const [users, setUsers] = React.useState<UserListRow[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [tableName, setTableName] = React.useState<(typeof TABLE_OPTIONS)[number]>("all");
  const [action, setAction] = React.useState<(typeof ACTION_OPTIONS)[number]>("all");

  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");

  const [nextToken, setNextToken] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<AuditLogRow | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [valuesTab, setValuesTab] = React.useState<"before" | "after">("after");

  const [sortKey, setSortKey] = React.useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const limit = 50;

  async function loadPage(opts?: { reset?: boolean }) {
    const reset = Boolean(opts?.reset);
    if (reset) setLoading(true);
    else setLoadingMore(true);

    setError(null);

    const res = await listAuditLogsAction({
      q: dq,
      userId: userId && userId !== "all" ? Number(userId) : undefined,
      tableName: tableName === "all" ? undefined : tableName,
      action: action === "all" ? undefined : action,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
      limit,
      nextToken: reset ? null : nextToken,
    });

    if (res.error) {
      if (reset) setRows([]);
      setNextToken(null);
      setError(res.error);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const incoming = res.data ?? [];
    if (reset) {
      setRows(incoming);
    } else {
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.logId));
        const merged = prev.slice();
        for (const r of incoming) {
          if (!seen.has(r.logId)) merged.push(r);
        }
        return merged;
      });
    }

    setNextToken(res.nextToken ?? null);
    setLoading(false);
    setLoadingMore(false);
  }

  React.useEffect(() => {
    // Reset pagination when filters change
    setNextToken(null);
    loadPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, userId, tableName, action, dateFrom, dateTo, refreshNonce]);

  React.useEffect(() => {
    let cancelled = false;
    async function bootUsers() {
      setUsersLoading(true);
      try {
        const res = await listUsersAction();
        if (cancelled) return;
        if (res.error) {
          setUsers([]);
          toast({ variant: "destructive", title: "Usuarios", description: res.error });
          return;
        }
        setUsers(res.data ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setUsers([]);
        toast({ variant: "destructive", title: "Usuarios", description: e?.message ?? "No se pudieron cargar usuarios" });
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    }

    bootUsers();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const displayedRows = React.useMemo(() => {
    const copy = rows.slice();

    const dirMult = sortDir === "asc" ? 1 : -1;
    const getTs = (r: AuditLogRow) => {
      const t = new Date(String(r.timestamp ?? "")).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    copy.sort((a, b) => {
      let c = 0;
      if (sortKey === "timestamp") {
        c = getTs(a) - getTs(b);
      } else if (sortKey === "action") {
        c = compareNullable(a.action, b.action);
      } else if (sortKey === "tableName") {
        c = compareNullable(a.tableName, b.tableName);
      } else if (sortKey === "record") {
        c = Number(a.recordId ?? 0) - Number(b.recordId ?? 0);
        if (c === 0) c = compareNullable(a.recordLabel, b.recordLabel);
      } else if (sortKey === "user") {
        c = compareNullable(a.userName ?? String(a.userId), b.userName ?? String(b.userId));
      } else if (sortKey === "changes") {
        c = compareNullable(summarizeChange(a), summarizeChange(b));
      }

      if (c === 0) {
        // Stable-ish: tie-breaker by timestamp desc then logId
        const t = getTs(b) - getTs(a);
        if (t !== 0) return t;
        return String(a.logId).localeCompare(String(b.logId));
      }

      return c * dirMult;
    });

    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(nextKey: SortKey) {
    setSortKey((prevKey) => {
      if (prevKey === nextKey) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      // First click on any column sorts ascending (menor -> mayor)
      setSortDir("asc");
      return nextKey;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Auditoría</h1>
          <p className="text-muted-foreground">
            Registro de cambios (AuditLog): quién hizo qué, cuándo y sobre qué registro.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setRefreshNonce((n) => n + 1)}
            disabled={loading || loadingMore}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setQ("");
              setUserId("all");
              setTableName("all");
              setAction("all");
              setDateFrom("");
              setDateTo("");
              setRefreshNonce((n) => n + 1);
            }}
            disabled={loading || loadingMore}
          >
            <X className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtra por texto, usuario, tabla, acción y fechas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-4">
              <Label>Buscar</Label>
              <Input
                placeholder="Ej: UPDATE Document 123"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Usuario</Label>
              <Select value={userId} onValueChange={(v) => setUserId(v)} disabled={usersLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={usersLoading ? "Cargando…" : "Todos"} />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value="all">Todos</SelectItem>
                  {users.map((u) => {
                    const name = String(u.username ?? "").trim();
                    const suffix = u.isEnabled ? "" : " (Inactivo)";
                    return (
                      <SelectItem key={u.userId} value={String(u.userId)}>
                        {name} · #{u.userId}{suffix}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label>Tabla</Label>
              <Select value={tableName} onValueChange={(v) => setTableName(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "all" ? "Todas" : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label>Acción</Label>
              <Select value={action} onValueChange={(v) => setAction(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a === "all" ? "Todas" : a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label>Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Label>Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              Mostrando {rows.length} · Límite {limit}
              {nextToken ? " · Hay más resultados" : ""}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => loadPage({ reset: true })}
                disabled={loading || loadingMore}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refrescar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
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
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px] cursor-pointer select-none" onClick={() => toggleSort("timestamp")}>
                      Fecha{sortIndicator(sortKey === "timestamp", sortDir)}
                    </TableHead>
                    <TableHead className="w-[110px] cursor-pointer select-none" onClick={() => toggleSort("timestamp")}>
                      Hora{sortIndicator(sortKey === "timestamp", sortDir)}
                    </TableHead>
                    <TableHead className="w-[140px] cursor-pointer select-none" onClick={() => toggleSort("action")}>
                      Acción{sortIndicator(sortKey === "action", sortDir)}
                    </TableHead>
                    <TableHead className="w-[160px] cursor-pointer select-none" onClick={() => toggleSort("tableName")}>
                      Tabla{sortIndicator(sortKey === "tableName", sortDir)}
                    </TableHead>
                    <TableHead className="min-w-[220px] cursor-pointer select-none" onClick={() => toggleSort("record")}>
                      Registro{sortIndicator(sortKey === "record", sortDir)}
                    </TableHead>
                    <TableHead className="w-[220px] cursor-pointer select-none" onClick={() => toggleSort("user")}>
                      Usuario{sortIndicator(sortKey === "user", sortDir)}
                    </TableHead>
                    <TableHead className="min-w-[220px] cursor-pointer select-none" onClick={() => toggleSort("changes")}>
                      Cambios{sortIndicator(sortKey === "changes", sortDir)}
                    </TableHead>
                    <TableHead className="text-right">Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedRows.map((r) => (
                    <TableRow key={r.logId}>
                      {(() => {
                        const { date, time } = fmtDateTime(r.timestamp);
                        return (
                          <>
                            <TableCell>{date}</TableCell>
                            <TableCell className="font-mono text-xs">{time}</TableCell>
                          </>
                        );
                      })()}

                      <TableCell>
                        <ActionBadge action={r.action} />
                      </TableCell>

                      <TableCell className="font-mono text-xs">{r.tableName}</TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <div className="font-mono text-xs">#{r.recordId}</div>
                          {r.recordLabel ? (
                            <div className="text-xs text-muted-foreground line-clamp-1">{r.recordLabel}</div>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        {r.userName ? (
                          <span>{r.userName}</span>
                        ) : (
                          <span className="text-muted-foreground">User #{r.userId}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="text-xs text-muted-foreground">{summarizeChange(r)}</div>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelected(r);
                            setSheetOpen(true);
                          }}
                        >
                          Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => loadPage({ reset: false })}
              disabled={loading || loadingMore || !nextToken}
            >
              {loadingMore ? "Cargando…" : nextToken ? "Cargar más" : "No hay más"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalle de Auditoría</SheetTitle>
            <SheetDescription>
              {selected ? summarizeChange(selected) : ""}
            </SheetDescription>
          </SheetHeader>

          {selected ? (
            <div className="grid gap-4 pt-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Timestamp</div>
                  <div className="font-mono text-xs break-all">{selected.timestamp}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">IP / User-Agent</div>
                  <div className="font-mono text-xs break-all">{selected.ipAddress ?? "-"}</div>
                  <div className="text-xs break-all mt-1">{selected.userAgent ?? "-"}</div>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Registro</div>
                  <div className="text-sm">
                    {selected.recordLabel ? (
                      <span className="font-medium">{selected.recordLabel}</span>
                    ) : (
                      <span className="text-muted-foreground">(sin etiqueta)</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ActionBadge action={selected.action} />
                    <Badge variant="outline" className="font-mono text-xs">
                      {selected.tableName}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      #{selected.recordId}
                    </Badge>
                    {(() => {
                      const href = pickHref(selected.tableName, selected.recordId);
                      if (!href) return null;
                      return (
                        <Link href={href} className="text-xs underline text-muted-foreground hover:text-foreground">
                          Abrir registro
                        </Link>
                      );
                    })()}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Resumen</div>
                  <div className="text-sm font-medium mt-1">{summarizeChange(selected)}</div>

                  <div className="mt-2 text-xs text-muted-foreground">Cambios principales</div>
                  <div className="text-xs mt-1">
                    {(() => {
                      if (String(selected.action ?? "").toUpperCase() !== "UPDATE") return "-";
                      const labels = friendlyChangedLabels(selected, 8);
                      if (!labels.length) return "(sin detalle)";
                      return labels.join(", ") + (Array.isArray(selected.changedFields) && selected.changedFields.length > 8 ? "…" : "");
                    })()}
                  </div>
                </div>
              </div>

              {/* Small screens: tabs */}
              <div className="md:hidden">
                <Tabs value={valuesTab} onValueChange={(v) => setValuesTab(v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="before" className="flex-1">
                      Antes
                    </TabsTrigger>
                    <TabsTrigger value="after" className="flex-1">
                      Después
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="before" className="mt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">OldValues</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText(prettyJson(selected.oldValues));
                          toast({ title: "Copiado", description: "OldValues copiado al portapapeles" });
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                    <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{prettyJson(selected.oldValues)}</pre>
                  </TabsContent>

                  <TabsContent value="after" className="mt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">NewValues</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText(prettyJson(selected.newValues));
                          toast({ title: "Copiado", description: "NewValues copiado al portapapeles" });
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                    <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{prettyJson(selected.newValues)}</pre>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Desktop/tablet: side-by-side */}
              <div className="hidden md:grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">OldValues</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(prettyJson(selected.oldValues));
                        toast({ title: "Copiado", description: "OldValues copiado al portapapeles" });
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{prettyJson(selected.oldValues)}</pre>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">NewValues</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(prettyJson(selected.newValues));
                        toast({ title: "Copiado", description: "NewValues copiado al portapapeles" });
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{prettyJson(selected.newValues)}</pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sin selección.</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
