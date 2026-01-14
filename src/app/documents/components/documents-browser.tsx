"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronUp, ChevronsUpDown, Loader2, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

import { useDebounce } from "@/hooks/use-debounce";
import { listDocuments, type DocumentListRow } from "@/actions/list-documents";
import { countDocuments } from "@/actions/count-documents";
import { getDocumentDetails, type DocumentDetails } from "@/actions/get-document-details";
import { getProductDetails } from "@/actions/get-product-details";
import { deleteDocumentAction } from "@/actions/delete-document";
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

  const router = useRouter();

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageTokens, setPageTokens] = useState<Record<number, string | null>>({ 1: null });
  const [pageNextToken, setPageNextToken] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<string>("");
  const [isScanMode, setIsScanMode] = useState<boolean>(true);

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

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productDialogLoading, setProductDialogLoading] = useState(false);
  const [productDialogError, setProductDialogError] = useState<string | null>(null);
  const [productDialogData, setProductDialogData] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function openProductDetails(productId: number) {
    setProductDialogOpen(true);
    setProductDialogLoading(true);
    setProductDialogError(null);
    setProductDialogData(null);
    try {
      const res: any = await getProductDetails(productId);
      if (res?.error) throw new Error(String(res.error));
      const data = res?.data;
      if (!data?.success) throw new Error(String(data?.error ?? 'No se pudo cargar el producto'));
      setProductDialogData(data);
    } catch (e: any) {
      setProductDialogError(e?.message ?? 'No se pudo cargar el producto');
    } finally {
      setProductDialogLoading(false);
    }
  }

  function handleViewPdf() {
    if (!selectedDocumentId) return;
    router.push(`/documents/${selectedDocumentId}/pdf`);
  }

  async function handleDeleteSelected() {
    if (!selectedDocumentId) return;
    setDeleting(true);
    try {
      const res: any = await deleteDocumentAction({ documentId: selectedDocumentId });
      if (!res?.success) throw new Error(String(res?.error ?? 'No se pudo eliminar'));
      setSelectedDocumentId(null);
      setDetails(null);
      await refreshDocs();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  }

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

  // Clamp page when total changes to avoid states like "Página 4 de 1".
  useEffect(() => {
    if (totalPages === 0) {
      if (page !== 1) setPage(1);
      return;
    }
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

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
      const result = await listDocuments({
        q: debouncedQ,
        dateFrom,
        dateTo,
        customerId: customerId === "all" ? undefined : Number(customerId),
        warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
        documentTypeId: documentTypeId === "all" ? undefined : Number(documentTypeId),
        // Use scan-mode pagination to keep ordering stable and avoid token-related page glitches.
        useScan: true,
        nextToken: undefined,
        page,
        pageSize,
      });

      if (result.error) {
        setDocs([]);
        setPageNextToken(null);
        setIsScanMode(true);
        setError(result.error);
      } else {
        setDocs(result.data ?? []);
        const scan = Boolean((result as any).scanMode);
        setIsScanMode(scan);

        // Token paging is not used in scan mode.
        const nt = scan ? null : (String((result as any).nextToken ?? "") || null);
        setPageNextToken(nt);
        if (!scan) {
          setPageTokens((prev) => {
            const next = { ...prev };
            if (nt) next[page + 1] = nt;
            else delete next[page + 1];
            return next;
          });
        }
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

    // In scan mode, jumping is just setting the page.
    if (isScanMode) {
      setPage(target);
      return;
    }

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
          {loadingDocs && (
            <div className="mb-3">
              <div className="h-1 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-1/2 animate-pulse rounded bg-primary/60" />
              </div>
            </div>
          )}
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
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {d.number}
                            {selectedDocumentId === d.documentId && loadingDetails && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </span>
                        </TableCell>
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
                    disabled={loadingDocs || (isScanMode ? (totalPages > 0 ? page >= totalPages : true) : !pageNextToken)}
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando detalle…
              </div>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !details ? (
            <div className="text-sm text-muted-foreground">No hay detalle.</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Operaciones del documento
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleViewPdf} disabled={!selectedDocumentId}>
                    Ver / Descargar PDF
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={deleting || !selectedDocumentId}>
                        {deleting ? 'Eliminando…' : 'Eliminar'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Solo se eliminarán documentos NO finalizados. Si ya impactó stock/kardex, se bloqueará.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSelected}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

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

              {details.liquidation?.result?.totals && (
                <Card className="border-0 bg-indigo-600 text-white">
                  <CardHeader>
                    <CardTitle className="text-white">Resumen Financiero</CardTitle>
                    <div className="text-xs text-indigo-100">Vista general de costos y ganancias</div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <div className="text-xs text-indigo-100">Costo Total de Compra</div>
                        <div className="text-lg font-semibold">{formatMoney(details.liquidation.result.totals.totalPurchaseCost)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-indigo-100">Descuento Total Aplicado</div>
                        <div className="text-lg font-semibold">{formatMoney(details.liquidation.result.totals.totalDiscount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-indigo-100">IVA Total</div>
                        <div className="text-lg font-semibold">{formatMoney(details.liquidation.result.totals.totalIVA)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-indigo-100">Flete Distribuido</div>
                        <div className="text-lg font-semibold">{formatMoney(details.liquidation.result.totals.totalFreight)}</div>
                      </div>
                    </div>

                    <div className="my-4 h-px bg-indigo-200/30" />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-xs text-indigo-100">Costo de factura</div>
                        <div className="text-xl font-semibold">{formatMoney(details.liquidation.result.totals.totalFinalCost)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-indigo-100">Precio de Venta Sugerido</div>
                        <div className="text-xl font-semibold">{formatMoney(details.liquidation.result.totals.totalSalePrice)}</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs text-indigo-100">Ganancia Proyectada</div>
                      <div className="text-xl font-semibold">{formatMoney(details.liquidation.result.totals.totalProfit)}</div>
                      <div className="mt-2 h-3 w-full overflow-hidden rounded bg-indigo-900/30">
                        <div
                          className="h-3 bg-emerald-400"
                          style={{
                            width: `${Math.max(0, Math.min(100, Number(details.liquidation.result.totals.profitMarginPercentage ?? 0))).toFixed(2)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-indigo-100">Margen: {Number(details.liquidation.result.totals.profitMarginPercentage ?? 0).toFixed(2)}%</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">ID</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Costo unit.</TableHead>
                    <TableHead className="text-right">Flete unit.</TableHead>
                    <TableHead>Flete</TableHead>
                    <TableHead className="text-right">Costo final</TableHead>
                    <TableHead className="text-right">Venta unit.</TableHead>
                    <TableHead className="text-right">Venta total</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-muted-foreground">
                        Sin items.
                      </TableCell>
                    </TableRow>
                  ) : (
                    details.items.map((it, idx) => {
                      const liqLine = details.liquidation?.result?.lines?.[idx];
                      const unitFreight = liqLine ? liqLine.unitFreight : 0;
                      const unitFinalCost = liqLine ? liqLine.unitFinalCost : it.unitcost;
                      const unitSale = liqLine ? liqLine.unitSalePrice : 0;
                      const totalSale = liqLine ? liqLine.totalSalePrice : 0;

                      const freightId = liqLine ? String((liqLine as any).freightId ?? '') : '';
                      const freightName =
                        details.liquidation?.config?.freightRates?.find((f: any) => String(f.id) === freightId)?.name ??
                        (!details.liquidation?.config?.useMultipleFreights
                          ? details.liquidation?.config?.freightRates?.[0]?.name
                          : '') ??
                        '';

                      return (
                        <TableRow key={it.id}>
                          <TableCell>{it.id}</TableCell>
                          <TableCell>{it.productname}</TableCell>
                          <TableCell className="text-muted-foreground">{it.productcode ?? "—"}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">{formatMoney(it.unitcost)}</TableCell>
                          <TableCell className="text-right">{formatMoney(unitFreight)}</TableCell>
                          <TableCell>{freightName || '—'}</TableCell>
                          <TableCell className="text-right">{formatMoney(unitFinalCost)}</TableCell>
                          <TableCell className="text-right">{formatMoney(unitSale)}</TableCell>
                          <TableCell className="text-right">{formatMoney(totalSale)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openProductDetails(it.productid)}
                            >
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de producto</DialogTitle>
            <DialogDescription>
              {details?.customername ? `Proveedor: ${details.customername}` : ""}
              {details?.customercountryname ? ` · País: ${details.customercountryname}` : ""}
            </DialogDescription>
          </DialogHeader>

          {productDialogLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando producto…
            </div>
          ) : productDialogError ? (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{productDialogError}</AlertDescription>
            </Alert>
          ) : !productDialogData?.product ? (
            <div className="text-sm text-muted-foreground">Sin información.</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-2">
              <div className="text-sm">
                <div className="text-muted-foreground">ID</div>
                <div>{String(productDialogData.product.idProduct ?? "")}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Nombre</div>
                <div>{String(productDialogData.product.name ?? "")}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Código</div>
                <div>{productDialogData.product.code ? String(productDialogData.product.code) : "—"}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Unidad</div>
                <div>{productDialogData.product.measurementUnit ? String(productDialogData.product.measurementUnit) : "—"}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Costo</div>
                <div>{formatMoney(Number(productDialogData.product.cost ?? 0))}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Precio</div>
                <div>{formatMoney(Number(productDialogData.product.price ?? 0))}</div>
              </div>
              <div className="text-sm md:col-span-2">
                <div className="text-muted-foreground">Descripción</div>
                <div>{productDialogData.product.description ? String(productDialogData.product.description) : "—"}</div>
              </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="text-sm">
                  <div className="text-muted-foreground">Barcodes</div>
                  <div>
                    {Array.isArray(productDialogData.barcodes) && productDialogData.barcodes.length > 0
                      ? productDialogData.barcodes.map((b: any) => String(b?.value ?? '')).filter(Boolean).join(', ')
                      : '—'}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">Impuestos</div>
                  <div>
                    {Array.isArray(productDialogData.taxes) && productDialogData.taxes.length > 0
                      ? productDialogData.taxes
                          .map((t: any) => `${String(t.name ?? t.taxId)} (${Number(t.rate ?? 0)}%)`)
                          .join(' · ')
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="text-sm">
                <div className="text-muted-foreground">Stock (por almacén)</div>
                {Array.isArray(productDialogData.stocks) && productDialogData.stocks.length > 0 ? (
                  <div className="mt-2 overflow-auto rounded border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="p-2 text-left">Almacén</th>
                          <th className="p-2 text-right">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productDialogData.stocks.map((s: any) => (
                          <tr key={String(s.warehouseId)} className="border-b last:border-b-0">
                            <td className="p-2">{s.warehouseName ?? `#${s.warehouseId}`}</td>
                            <td className="p-2 text-right">{Number(s.quantity ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>—</div>
                )}
              </div>

              <div className="text-sm">
                <div className="text-muted-foreground">Stock control</div>
                {Array.isArray(productDialogData.stockControls) && productDialogData.stockControls.length > 0 ? (
                  <div className="mt-2 overflow-auto rounded border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="p-2 text-left">Cliente</th>
                          <th className="p-2 text-right">Punto reorden</th>
                          <th className="p-2 text-right">Cant. preferida</th>
                          <th className="p-2 text-right">Warn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productDialogData.stockControls.map((sc: any) => (
                          <tr key={String(sc.stockControlId)} className="border-b last:border-b-0">
                            <td className="p-2">{sc.customerName ?? (sc.customerId ? `#${sc.customerId}` : '—')}</td>
                            <td className="p-2 text-right">{Number(sc.reorderPoint ?? 0)}</td>
                            <td className="p-2 text-right">{Number(sc.preferredQuantity ?? 0)}</td>
                            <td className="p-2 text-right">{sc.isLowStockWarningEnabled ? 'Sí' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>—</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
