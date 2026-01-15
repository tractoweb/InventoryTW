"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { listAuditLogsAction, type AuditLogRow } from "@/actions/list-audit-logs";

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
  const [rows, setRows] = React.useState<AuditLogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);

  const [userId, setUserId] = React.useState<string>("");
  const [tableName, setTableName] = React.useState<string>("");
  const [action, setAction] = React.useState<string>("");

  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");

  const [page, setPage] = React.useState(1);
  const [pageTokens, setPageTokens] = React.useState<Record<number, string | null>>({ 1: null });
  const [hasNext, setHasNext] = React.useState(false);

  const [selected, setSelected] = React.useState<AuditLogRow | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const limit = 50;

  const currentToken = pageTokens[page] ?? null;

  async function load() {
    setLoading(true);
    setError(null);

    const res = await listAuditLogsAction({
      q: dq,
      userId: userId ? Number(userId) : undefined,
      tableName: tableName ? tableName : undefined,
      action: action ? action : undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
      limit,
      nextToken: currentToken,
    });

    if (res.error) {
      setRows([]);
      setHasNext(false);
      setError(res.error);
      setLoading(false);
      return;
    }

    setRows(res.data ?? []);

    const next = res.nextToken ?? null;
    setHasNext(Boolean(next));
    setPageTokens((prev) => ({ ...prev, [page + 1]: next }));

    setLoading(false);
  }

  React.useEffect(() => {
    // Reset pagination when filters change
    setPage(1);
    setPageTokens({ 1: null });
  }, [dq, userId, tableName, action, dateFrom, dateTo]);

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, currentToken, dq, userId, tableName, action, dateFrom, dateTo]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auditoría</h1>
        <p className="text-muted-foreground">
          Registro de cambios (AuditLog): quién hizo qué, cuándo y sobre qué registro.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <Label>Buscar</Label>
              <Input
                placeholder="Ej: UPDATE Document 123"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div>
              <Label>UserId</Label>
              <Input
                type="number"
                placeholder="(opcional)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>

            <div>
              <Label>Tabla</Label>
              <Input
                placeholder="Document, Product, User…"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </div>

            <div>
              <Label>Acción</Label>
              <Input
                placeholder="CREATE/UPDATE/DELETE…"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
            </div>

            <div>
              <Label>Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              Página {page} · Mostrando {rows.length} (límite {limit})
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page === 1}>
                Anterior
              </Button>
              <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={loading || !hasNext}>
                Siguiente
              </Button>
              <Button variant="outline" onClick={load} disabled={loading}>
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
                    <TableHead className="w-[150px]">Fecha</TableHead>
                    <TableHead className="w-[120px]">Acción</TableHead>
                    <TableHead className="w-[160px]">Tabla</TableHead>
                    <TableHead className="w-[120px]">RecordId</TableHead>
                    <TableHead className="w-[220px]">Usuario</TableHead>
                    <TableHead className="text-right">Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.logId}>
                      <TableCell>{toIsoDate(r.timestamp)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.action}</TableCell>
                      <TableCell className="font-mono text-xs">{r.tableName}</TableCell>
                      <TableCell className="font-mono text-xs">{r.recordId}</TableCell>
                      <TableCell>
                        {r.userName ? (
                          <span>{r.userName}</span>
                        ) : (
                          <span className="text-muted-foreground">User #{r.userId}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelected(r);
                            setDialogOpen(true);
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle de Auditoría</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.action} ${selected.tableName} #${selected.recordId}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="grid gap-4">
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

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium mb-2">OldValues</div>
                  <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{prettyJson(selected.oldValues)}</pre>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">NewValues</div>
                  <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{prettyJson(selected.newValues)}</pre>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sin selección.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
