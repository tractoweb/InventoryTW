"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ChevronDown, ChevronUp, ChevronsUpDown, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

import { useDebounce } from "@/hooks/use-debounce";
import { listDocuments, type DocumentListRow } from "@/actions/list-documents";
import { countDocuments } from "@/actions/count-documents";
import { getDocumentDetails, type DocumentDetails } from "@/actions/get-document-details";
import { getCustomers, type CustomerListItem } from "@/actions/get-customers";
import { getWarehouses, type WarehouseListItem } from "@/actions/get-warehouses";
import { getDocumentTypes, type DocumentTypeListItem } from "@/actions/get-document-types";

type Option = { value: string; label: string };

type SortField = "number" | "date" | "total" | "supplier";

function formatMoney(amount: number) {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function todayISODate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DocumentsBrowser() {
  const pageSize = 10;

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageTokens, setPageTokens] = useState<Record<number, string | null>>({ 1: null });
  const [pageNextToken, setPageNextToken] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<string>("");

  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [dateFrom, setDateFrom] = useState<string>(todayISODate);
  const [dateTo, setDateTo] = useState<string>(todayISODate);

  const [customerId, setCustomerId] = useState<string>("all");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [documentTypeId, setDocumentTypeId] = useState<string>("all");

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeListItem[]>([]);

  const [docs, setDocs] = useState<DocumentListRow[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [details, setDetails] = useState<DocumentDetails | null>(null);

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerOptions: Option[] = useMemo(() => {
    return [
      { value: "all", label: "Todos" },
      ...customers.map((c) => ({ value: String(c.idCustomer), label: c.name })),
    ];
  }, [customers]);

  const warehouseOptions: Option[] = useMemo(() => {
    return [
      { value: "all", label: "Todos" },
      ...warehouses.map((w) => ({ value: String(w.idWarehouse), label: String(w.name ?? w.idWarehouse) })),
    ];
  }, [warehouses]);

  const documentTypeOptions: Option[] = useMemo(() => {
    return [
      { value: "all", label: "Todos" },
      ...documentTypes.map((dt) => ({ value: String(dt.documentTypeId), label: String(dt.name ?? dt.documentTypeId) })),
    ];
  }, [documentTypes]);

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  const sortedDocs = useMemo(() => {
    const copy = docs.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortBy === "number") return String(a.number).localeCompare(String(b.number)) * dir;
      if (sortBy === "supplier") return String(a.customerName ?? "").localeCompare(String(b.customerName ?? "")) * dir;
      if (sortBy === "total") return (Number(a.total ?? 0) - Number(b.total ?? 0)) * dir;
      return String(a.stockDate ?? a.date ?? "").localeCompare(String(b.stockDate ?? b.date ?? "")) * dir;
    });
    return copy;
  }, [docs, sortBy, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortBy !== field) {
      setSortBy(field);
      setSortDir(field === "number" || field === "supplier" ? "asc" : "desc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const SortableHead = ({
    field,
    label,
    className,
    align = "left",
  }: {
    field: SortField;
    label: string;
    className?: string;
    align?: "left" | "right";
  }) => {
    const active = sortBy === field;
    const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";

    const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;

    return (
      <TableHead
        aria-sort={ariaSort}
        className={cn(align === "right" && "text-right", className)}
      >
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={cn(
            "group inline-flex w-full items-center gap-1 rounded-md px-2 py-1 -mx-2 -my-1 select-none hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            align === "right" && "justify-end"
          )}
          title={`Ordenar por ${label}`}
        >
          <span>{label}</span>
          <Icon
            className={cn(
              "h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground",
              !active && "opacity-60"
            )}
          />
        </button>
      </TableHead>
    );
  };

  const filtersKey = useMemo(() => {
    return JSON.stringify({
      q: debouncedQ,
      dateFrom,
      dateTo,
      customerId,
      warehouseId,
      documentTypeId,
    });
  }, [debouncedQ, dateFrom, dateTo, customerId, warehouseId, documentTypeId]);

  const refreshDocs = async () => {
    setLoadingDocs(true);
    setError(null);
    try {
      const nextToken = pageTokens[page] ?? null;
      const result = await listDocuments({
        q: debouncedQ,
        dateFrom,
        dateTo,
        customerId: customerId === "all" ? undefined : Number(customerId),
        warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
        documentTypeId: documentTypeId === "all" ? undefined : Number(documentTypeId),
        nextToken,
        page,
        pageSize,
      });

      if (result.error) {
        setDocs([]);
        setPageNextToken(null);
        setError(result.error);
      } else {
        setDocs(result.data ?? []);
        const nt = String((result as any).nextToken ?? "") || null;
        setPageNextToken(nt);
        setPageTokens((prev) => {
          const next = { ...prev };
          if (nt) next[page + 1] = nt;
          else delete next[page + 1];
          return next;
        });
      }
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    Promise.all([
      getCustomers({ onlyEnabled: true, onlySuppliers: true }),
      getWarehouses({ onlyEnabled: true }),
      getDocumentTypes(),
    ])
      .then(([cRes, wRes, dtRes]) => {
        if (!cRes.error) setCustomers(cRes.data ?? []);
        if (!wRes.error) setWarehouses(wRes.data ?? []);
        if (!dtRes.error) setDocumentTypes(dtRes.data ?? []);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  useEffect(() => {
    // Count is heavier, so only on filter changes.
    countDocuments({
      q: debouncedQ,
      dateFrom,
      dateTo,
      customerId: customerId === "all" ? undefined : Number(customerId),
      warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
      documentTypeId: documentTypeId === "all" ? undefined : Number(documentTypeId),
    })
      .then((res) => {
        if (res.error) setTotal(0);
        else setTotal(Number(res.total ?? 0));
      })
      .catch(() => setTotal(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    // Reset token paging when filters change
    setPage(1);
    setPageTokens({ 1: null });
    setPageNextToken(null);
    setJumpTo("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    refreshDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, dateFrom, dateTo, customerId, warehouseId, documentTypeId, page]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setDetails(null);
      return;
    }

    setLoadingDetails(true);
    setError(null);
    setDetails(null);

    getDocumentDetails(selectedDocumentId)
      .then((res) => {
        if (res.error) setError(res.error);
        else setDetails(res.data ?? null);
      })
      .finally(() => setLoadingDetails(false));
  }, [selectedDocumentId]);

  useEffect(() => {
    // When paging, clear selection to avoid showing detail from another page.
    setSelectedDocumentId(null);
    setDetails(null);
  }, [page]);

  const clearFilters = () => {
    setQ("");
    setCustomerId("all");
    setWarehouseId("all");
    setDocumentTypeId("all");
    setPageTokens({ 1: null });
    setPageNextToken(null);
    setPage(1);
  };

  async function handleJump() {
    const requested = Math.trunc(Number(jumpTo));
    if (!Number.isFinite(requested) || requested < 1) return;
    const target = totalPages > 0 ? Math.min(requested, totalPages) : requested;
    if (target === page) return;

    // In token-based pagination we may need to learn tokens up to target.
    if (pageTokens[target] === undefined) {
      setLoadingDocs(true);
      try {
        const tokens: Record<number, string | null> = { ...pageTokens };
        const maxKnown = Math.max(...Object.keys(tokens).map((k) => Number(k)).filter((n) => Number.isFinite(n)));
        let current = Number.isFinite(maxKnown) ? maxKnown : 1;
        while (current < target) {
          const tokenForCurrent = tokens[current] ?? null;
          if (tokens[current + 1] !== undefined) {
            current += 1;
            continue;
          }
          const res = await listDocuments({
            q: debouncedQ,
            dateFrom,
            dateTo,
            customerId: customerId === "all" ? undefined : Number(customerId),
            warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
            documentTypeId: documentTypeId === "all" ? undefined : Number(documentTypeId),
            nextToken: tokenForCurrent,
            page: current,
            pageSize,
          });
          const nt = String((res as any).nextToken ?? "") || null;
          tokens[current + 1] = nt;
          if (!nt) break;
          current += 1;
        }
        setPageTokens(tokens);
      } finally {
        setLoadingDocs(false);
      }
    }

    setPage(target);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
          <p className="text-muted-foreground">
            Consulta tipo Aronium: filtros + lista + artículos del documento.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/documents/new">Agregar</Link>
          </Button>
          <Button variant="outline" onClick={refreshDocs} disabled={loadingDocs}>
            Refrescar
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground mb-1">Buscar</div>
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Número, referencia u orden"
            />
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Proveedor</div>
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Proveedor" />
              </SelectTrigger>
              <SelectContent>
                {customerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Almacén</div>
            <Select
              value={warehouseId}
              onValueChange={(v) => {
                setWarehouseId(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Almacén" />
              </SelectTrigger>
              <SelectContent>
                {warehouseOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Tipo</div>
            <Select
              value={documentTypeId}
              onValueChange={(v) => {
                setDocumentTypeId(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {documentTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Desde</div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Hasta</div>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="md:col-span-6 flex gap-2">
            <Button variant="outline" onClick={clearFilters}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDocs ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead field="number" label="Número" className="w-[110px]" />
                    <TableHead>Tipo</TableHead>
                    <SortableHead field="supplier" label="Proveedor" />
                    <SortableHead field="date" label="Fecha" />
                    <SortableHead field="total" label="Total" align="right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Sin resultados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedDocs.map((d) => (
                      <TableRow
                        key={d.documentId}
                        className={
                          selectedDocumentId === d.documentId
                            ? "bg-muted/50"
                            : "cursor-pointer"
                        }
                        onClick={() => setSelectedDocumentId(d.documentId)}
                      >
                        <TableCell className="font-medium">{d.number}</TableCell>
                        <TableCell>{d.documentTypeName ?? d.documentTypeId}</TableCell>
                        <TableCell>{d.customerName ?? "-"}</TableCell>
                        <TableCell>{d.date}</TableCell>
                        <TableCell className="text-right">{formatMoney(d.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  {total > 0
                    ? `Página ${page} de ${totalPages} · Mostrando ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} de ${total}`
                    : "0 resultados"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loadingDocs}
                  >
                    Anterior
                  </Button>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Ir a</div>
                    <Input
                      className="h-9 w-20"
                      type="number"
                      min={1}
                      max={totalPages || undefined}
                      value={jumpTo}
                      onChange={(e) => setJumpTo(e.target.value)}
                    />
                    <Button variant="outline" onClick={handleJump} disabled={loadingDocs}>
                      Ir
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pageNextToken || loadingDocs}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Artículos del documento</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDocumentId ? (
            <div className="text-sm text-muted-foreground">Selecciona un documento arriba.</div>
          ) : loadingDetails ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !details ? (
            <div className="text-sm text-muted-foreground">No hay detalle.</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 md:grid-cols-4">
                <div className="text-sm">
                  <div className="text-muted-foreground">Proveedor</div>
                  <div>{details.customername ?? "-"}</div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">Tipo</div>
                  <div>{details.documenttypename}</div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">Almacén</div>
                  <div>{details.warehousename}</div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">Total</div>
                  <div>{formatMoney(details.total)}</div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">ID</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Impuesto</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Sin items.
                      </TableCell>
                    </TableRow>
                  ) : (
                    details.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>{it.id}</TableCell>
                        <TableCell>{it.productname}</TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                        <TableCell className="text-right">{formatMoney(it.price)}</TableCell>
                        <TableCell className="text-right">{formatMoney(it.taxamount)}</TableCell>
                        <TableCell className="text-right">{formatMoney(it.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
