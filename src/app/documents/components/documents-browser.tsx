"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
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
import { getDocumentDetails, type DocumentDetails } from "@/actions/get-document-details";
import { getProductDetails } from "@/actions/get-product-details";
import { deleteDocumentAction } from "@/actions/delete-document";
import { updateDocumentMetadataAction } from "@/actions/update-document-metadata";
import { updateDocumentItemsAction } from "@/actions/update-document-items";
import { searchProductsAction, type ProductSearchResult } from "@/actions/search-products";
import { voidDocumentAction } from "@/actions/void-document";
import { updateDocumentPaidStatusAction } from "@/actions/update-document-paid-status";
import { getCustomers, type CustomerListItem } from "@/actions/get-customers";
import { getWarehouses, type WarehouseListItem } from "@/actions/get-warehouses";
import { getDocumentTypes, type DocumentTypeListItem } from "@/actions/get-document-types";
import { useDocumentsCatalog } from "@/components/catalog/documents-catalog-provider";
import type { DocumentsCatalogRow } from "@/actions/list-documents-for-browser-all";

type Option = { value: string; label: string };

type SortField = "number" | "date" | "total" | "supplier";

function paidStatusLabelEs(paidStatus: number): string {
  const s = Number(paidStatus ?? 0);
  if (s === 2) return "Pagada";
  if (s === 1) return "Parcial";
  return "No paga";
}

function paidStatusVariant(paidStatus: number): "default" | "secondary" | "outline" {
  const s = Number(paidStatus ?? 0);
  if (s === 2) return "default";
  if (s === 1) return "secondary";
  return "outline";
}

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

function safeParseJson(raw: unknown): any | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (!(s.startsWith("{") || s.startsWith("["))) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function DocumentsBrowser({ initialDocumentId }: { initialDocumentId?: number | null }) {
  const pageSize = 10;

  const router = useRouter();

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);

  const [page, setPage] = useState(1);
  const [jumpTo, setJumpTo] = useState<string>("");

  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [dateFrom, setDateFrom] = useState<string>(todayISODate);
  const [dateTo, setDateTo] = useState<string>(todayISODate);
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);

  const [customerId, setCustomerId] = useState<string>("all");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [documentTypeId, setDocumentTypeId] = useState<string>("all");

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeListItem[]>([]);

  const catalog = useDocumentsCatalog();

  const didApplyInitialSelection = useRef(false);

  const allDocs = catalog.documents as DocumentsCatalogRow[];

  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [details, setDetails] = useState<DocumentDetails | null>(null);

  const detailsMeta = useMemo(() => {
    const categoryId = Number(details?.documenttypecategoryid ?? 0) || 0;
    const isPurchaseCategory = categoryId === 1;
    const isSalesCategory = categoryId === 2;

    const raw = String(details?.internalnote ?? "").trim();
    let isPosSale = false;
    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        isPosSale = parsed?.source === "POS" && parsed?.kind === "Sale";
      } catch {
        isPosSale = false;
      }
    }

    return { categoryId, isPurchaseCategory, isSalesCategory, isPosSale };
  }, [details]);

  const voidLinkMeta = useMemo(() => {
    const note = String(details?.note ?? "");
    const parsed = safeParseJson(details?.internalnote);

    let isVoidDocument = false;
    let originalDocumentId: number | null = null;
    let reversalDocumentId: number | null = null;
    let reversalDocumentNumber: string | null = null;

    if (parsed?.source === "SYSTEM" && parsed?.kind === "VOID") {
      isVoidDocument = true;
      const od = Number(parsed?.original?.documentId ?? 0);
      if (Number.isFinite(od) && od > 0) originalDocumentId = od;
    }

    const ridFromInternal = Number(parsed?.void?.reversalDocumentId ?? 0);
    if (Number.isFinite(ridFromInternal) && ridFromInternal > 0) {
      reversalDocumentId = ridFromInternal;
      const rn = String(parsed?.void?.reversalDocumentNumber ?? "").trim();
      reversalDocumentNumber = rn || null;
    }

    if (!reversalDocumentId) {
      const m = note.match(/ANULADO_ID\s*:\s*(\d+)/i);
      if (m?.[1]) {
        const ridFromNote = Number(m[1]);
        if (Number.isFinite(ridFromNote) && ridFromNote > 0) reversalDocumentId = ridFromNote;
      }
    }

    return { isVoidDocument, originalDocumentId, reversalDocumentId, reversalDocumentNumber };
  }, [details]);

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productDialogLoading, setProductDialogLoading] = useState(false);
  const [productDialogError, setProductDialogError] = useState<string | null>(null);
  const [productDialogData, setProductDialogData] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editThirdPartyName, setEditThirdPartyName] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [editItems, setEditItems] = useState<
    Array<{
      key: string;
      documentItemId?: number;
      productId?: number;
      productName: string;
      productCode: string | null;
      quantity: number;
      price: number;
      remove: boolean;
    }>
  >([]);

  const [editAddProductOpen, setEditAddProductOpen] = useState(false);
  const [editAddProductQuery, setEditAddProductQuery] = useState("");
  const debouncedEditAddProductQuery = useDebounce(editAddProductQuery, 250);
  const [editAddProductResults, setEditAddProductResults] = useState<ProductSearchResult[]>([]);
  const [editAddProductSearching, setEditAddProductSearching] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!editAddProductOpen) return;
      setEditAddProductSearching(true);
      const res = await searchProductsAction(String(debouncedEditAddProductQuery ?? ''), 30);
      setEditAddProductResults(res.data ?? []);
      setEditAddProductSearching(false);
    }, 50);

    return () => clearTimeout(handle);
  }, [debouncedEditAddProductQuery, editAddProductOpen]);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState<string>("");
  const [voidConfirmMessage, setVoidConfirmMessage] = useState<string | null>(null);
  const [voidConfirmProducts, setVoidConfirmProducts] = useState<
    Array<{ productId: number; name?: string; code?: string; stock: number; required: number }> | null
  >(null);

  const selectedDocRow = useMemo(() => {
    if (!selectedDocumentId) return null;
    return allDocs.find((d) => d.documentId === selectedDocumentId) ?? null;
  }, [allDocs, selectedDocumentId]);

  const selectedIsFinalized = Boolean(selectedDocRow?.isClockedOut ?? false);

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

  async function handleTogglePaidStatus() {
    if (!selectedDocumentId || !selectedDocRow) return;

    // Details can be stale; prefer the catalog row (always has paidStatus).
    const current = Number(selectedDocRow.paidStatus ?? 0);
    const next = current === 2 ? 0 : 2;

    try {
      const res: any = await updateDocumentPaidStatusAction({ documentId: selectedDocumentId, paidStatus: next });
      if (!res?.success) throw new Error(String(res?.error ?? "No se pudo actualizar"));

      await catalog.refresh();
      const det: any = await getDocumentDetails(selectedDocumentId);
      if (det?.error) throw new Error(String(det.error));
      setDetails(det.data ?? null);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo actualizar el estado de pago");
    }
  }

  function openEditDialog() {
    if (!details || !selectedDocumentId) return;
    if (selectedIsFinalized) return;
    setEditError(null);
    setEditThirdPartyName(String(details.customername ?? ""));
    setEditNote(String(details.note ?? ""));
    setEditItems(
      Array.isArray((details as any)?.items)
        ? ((details as any).items as any[]).map((it: any) => ({
            key: `existing-${String(it?.id)}`,
            documentItemId: Number(it?.id),
            productName: String(it?.productname ?? `#${String(it?.productid ?? '')}`),
            productCode: it?.productcode !== undefined && it?.productcode !== null ? String(it.productcode) : null,
            productId: Number(it?.productid ?? 0) || undefined,
            quantity: Number(it?.quantity ?? 0) || 0,
            price: Number(it?.price ?? 0) || 0,
            remove: false,
          }))
        : []
    );
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!selectedDocumentId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const payload: any = {
        documentId: selectedDocumentId,
        note: editNote,
      };
      if (detailsMeta.isSalesCategory) {
        payload.clientName = editThirdPartyName;
      }

      const res: any = await updateDocumentMetadataAction(payload);
      if (!res?.success) throw new Error(String(res?.error ?? "No se pudo modificar"));

      // Update items (quantities/prices + removals)
      const itemsPayload = editItems
        .map((it) => ({
          documentItemId:
            it.documentItemId !== undefined && Number.isFinite(Number(it.documentItemId)) && Number(it.documentItemId) > 0
              ? Number(it.documentItemId)
              : undefined,
          productId:
            it.documentItemId === undefined && it.productId !== undefined && Number.isFinite(Number(it.productId)) && Number(it.productId) > 0
              ? Number(it.productId)
              : undefined,
          quantity: Math.max(0, Number(it.quantity) || 0),
          price: Math.max(0, Number(it.price) || 0),
          remove: Boolean(it.remove),
        }))
        .filter((p) => Boolean(p.documentItemId) || Boolean(p.productId));

      const itemsRes: any = await updateDocumentItemsAction({ documentId: selectedDocumentId, items: itemsPayload });
      if (!itemsRes?.success) throw new Error(String(itemsRes?.error ?? 'No se pudieron actualizar los productos'));

      setEditOpen(false);

      // Reload detail and refresh catalog for updated thirdPartyName.
      setLoadingDetails(true);
      const dres: any = await getDocumentDetails(selectedDocumentId);
      if (dres?.error) setError(String(dres.error));
      else setDetails(dres?.data ?? null);
      await refreshDocs();
    } catch (e: any) {
      setEditError(e?.message ?? "No se pudo modificar");
    } finally {
      setEditSaving(false);
      setLoadingDetails(false);
    }
  }

  async function handleVoidSelected() {
    if (!selectedDocumentId) return;
    setVoiding(true);
    setVoidError(null);
    setVoidConfirmMessage(null);
    setVoidConfirmProducts(null);
    try {
      const res: any = await voidDocumentAction({ documentId: selectedDocumentId, reason: voidReason });

      if (!res?.success && res?.needsConfirmation) {
        setVoidConfirmMessage(String(res?.message ?? 'El stock de uno o más productos está en 0 (o insuficiente).'));
        setVoidConfirmProducts(Array.isArray(res?.affectedProducts) ? res.affectedProducts : null);
        return;
      }

      if (!res?.success) throw new Error(String(res?.error ?? 'No se pudo anular'));

      setVoidOpen(false);
      setVoidReason('');

      await refreshDocs();

      const rid = Number(res?.reversalDocumentId ?? 0);
      if (Number.isFinite(rid) && rid > 0) {
        router.push(`/documents/${rid}/pdf`);
      }
    } catch (e: any) {
      setVoidError(e?.message ?? 'No se pudo anular');
    } finally {
      setVoiding(false);
    }
  }

  async function handleVoidSelectedConfirmProceed() {
    if (!selectedDocumentId) return;
    setVoiding(true);
    setVoidError(null);
    try {
      const res: any = await voidDocumentAction({
        documentId: selectedDocumentId,
        reason: voidReason,
        confirmProceedWithZeroStock: true,
      });
      if (!res?.success) throw new Error(String(res?.error ?? 'No se pudo anular'));

      setVoidOpen(false);
      setVoidReason('');
      setVoidConfirmMessage(null);
      setVoidConfirmProducts(null);

      await refreshDocs();

      const rid = Number(res?.reversalDocumentId ?? 0);
      if (Number.isFinite(rid) && rid > 0) {
        router.push(`/documents/${rid}/pdf`);
      }
    } catch (e: any) {
      setVoidError(e?.message ?? 'No se pudo anular');
    } finally {
      setVoiding(false);
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

  const filteredDocs = useMemo(() => {
    const qTerm = String(debouncedQ ?? "").trim().toLowerCase();
    const cid = customerId === "all" ? null : Number(customerId);
    const wid = warehouseId === "all" ? null : Number(warehouseId);
    const dtid = documentTypeId === "all" ? null : Number(documentTypeId);

    return allDocs.filter((d) => {
      if (cid && Number.isFinite(cid)) {
        // Supplier filter: only meaningful for purchase documents.
        if (Number((d as any).documentCategoryId ?? 0) !== 1) return false;
        if (Number(d.customerId ?? 0) !== cid) return false;
      }
      if (wid && Number.isFinite(wid) && Number(d.warehouseId ?? 0) !== wid) return false;
      if (dtid && Number.isFinite(dtid) && Number(d.documentTypeId ?? 0) !== dtid) return false;

      const date = String(d.date ?? "");
      if (dateFilterEnabled) {
        if (dateFrom && date && date < dateFrom) return false;
        if (dateTo && date && date > dateTo) return false;
        if ((dateFrom || dateTo) && !date) return false;
      }

      if (qTerm) {
        const number = String(d.number ?? "").toLowerCase();
        const ref = String(d.referenceDocumentNumber ?? "").toLowerCase();
        const order = String(d.orderNumber ?? "").toLowerCase();
        if (!number.includes(qTerm) && !ref.includes(qTerm) && !order.includes(qTerm)) return false;
      }

      return true;
    });
  }, [allDocs, debouncedQ, customerId, warehouseId, documentTypeId, dateFrom, dateTo, dateFilterEnabled]);

  const sortedFilteredDocs = useMemo(() => {
    const copy = filteredDocs.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortBy === "number") return String(a.number).localeCompare(String(b.number)) * dir;
      if (sortBy === "supplier") {
        const an = String((a as any).thirdPartyName ?? a.customerName ?? "");
        const bn = String((b as any).thirdPartyName ?? b.customerName ?? "");
        return an.localeCompare(bn) * dir;
      }
      if (sortBy === "total") return (Number(a.total ?? 0) - Number(b.total ?? 0)) * dir;
      return String(a.stockDate ?? a.date ?? "").localeCompare(String(b.stockDate ?? b.date ?? "")) * dir;
    });
    return copy;
  }, [filteredDocs, sortBy, sortDir]);

  const total = sortedFilteredDocs.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  const pageDocs = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return sortedFilteredDocs.slice(startIdx, startIdx + pageSize);
  }, [sortedFilteredDocs, page, pageSize]);

  // Clamp page when total changes to avoid states like "Página 4 de 1".
  useEffect(() => {
    if (totalPages === 0) {
      if (page !== 1) setPage(1);
      return;
    }
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

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
      dateFrom: dateFilterEnabled ? dateFrom : "",
      dateTo: dateFilterEnabled ? dateTo : "",
      dateFilterEnabled,
      customerId,
      warehouseId,
      documentTypeId,
    });
  }, [debouncedQ, dateFrom, dateTo, dateFilterEnabled, customerId, warehouseId, documentTypeId]);

  const loadingDocs = catalog.status === "loading" || catalog.status === "idle";
  const catalogError = catalog.status === "error" ? catalog.error : null;

  const refreshDocs = async () => {
    setError(null);
    await catalog.refresh();
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
    // Load documents catalog once (cache across navigation).
    catalog.ensureLoaded().catch(() => {
      // handled via catalog.status
    });
  }, [catalog.ensureLoaded]);

  useEffect(() => {
    // Reset paging when filters change (local filtering)
    setPage(1);
    setJumpTo("");
    setSelectedDocumentId(null);
    setDetails(null);
  }, [filtersKey]);

  useEffect(() => {
    if (catalogError) setError(catalogError);
  }, [catalogError]);

  useEffect(() => {
    if (didApplyInitialSelection.current) return;
    const id = initialDocumentId ?? null;
    if (!id) return;
    if (catalog.status !== "ready") return;

    didApplyInitialSelection.current = true;
    const match = allDocs.find((d) => d.documentId === id);
    if (match?.number) setQ(match.number);
    setSelectedDocumentId(id);
    setPage(1);
  }, [initialDocumentId, catalog.status, allDocs]);

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
    setDateFilterEnabled(false);
    setPage(1);
  };

  async function handleJump() {
    const requested = Math.trunc(Number(jumpTo));
    if (!Number.isFinite(requested) || requested < 1) return;
    const target = totalPages > 0 ? Math.min(requested, totalPages) : requested;
    if (target === page) return;
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
            <div className="text-sm text-muted-foreground mb-1">Tercero</div>
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tercero" />
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
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">Desde</div>
              <Button
                type="button"
                variant={dateFilterEnabled ? "default" : "outline"}
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  setDateFilterEnabled((v) => !v);
                  setPage(1);
                }}
                title="Activar/desactivar filtro por fecha"
              >
                Fecha: {dateFilterEnabled ? "Sí" : "No"}
              </Button>
            </div>
            <Input
              type="date"
              value={dateFrom}
              disabled={!dateFilterEnabled}
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
              disabled={!dateFilterEnabled}
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
                    <TableHead className="w-[110px]">Pago</TableHead>
                    <TableHead>Tipo</TableHead>
                    <SortableHead field="supplier" label="Tercero" />
                    <TableHead>Usuario</TableHead>
                    <SortableHead field="date" label="Fecha" />
                    <SortableHead field="total" label="Total" align="right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {total === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground">
                        Sin resultados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageDocs.map((d) => (
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
                        <TableCell>
                          <Badge variant={paidStatusVariant(d.paidStatus)}>{paidStatusLabelEs(d.paidStatus)}</Badge>
                        </TableCell>
                        <TableCell>{d.documentTypeName ?? d.documentTypeId}</TableCell>
                        <TableCell>{(d as any).thirdPartyName ?? d.customerName ?? "-"}</TableCell>
                        <TableCell>{d.userName ?? String(d.userId ?? "-")}</TableCell>
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
                    disabled={loadingDocs || totalPages === 0 || page >= totalPages}
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

                  {voidLinkMeta.reversalDocumentId ? (
                    <Button variant="outline" asChild>
                      <Link href={`/documents/${voidLinkMeta.reversalDocumentId}/pdf`}>
                        Ver documento de anulación
                      </Link>
                    </Button>
                  ) : null}

                  {voidLinkMeta.originalDocumentId ? (
                    <Button variant="outline" asChild>
                      <Link href={`/documents/${voidLinkMeta.originalDocumentId}/pdf`}>
                        Ver documento original
                      </Link>
                    </Button>
                  ) : null}

                  <Button
                    variant="outline"
                    onClick={openEditDialog}
                    disabled={!selectedDocumentId || !details || selectedIsFinalized}
                  >
                    Modificar
                  </Button>

                  <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setVoidError(null);
                        setVoidReason('');
                        setVoidConfirmMessage(null);
                        setVoidConfirmProducts(null);
                        setVoidOpen(true);
                      }}
                      disabled={!selectedDocumentId || !selectedIsFinalized || voidLinkMeta.isVoidDocument || Boolean(voidLinkMeta.reversalDocumentId)}
                    >
                      Anular
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>¿Anular documento?</DialogTitle>
                        <DialogDescription>
                          Se creará un documento inverso para compensar stock/kardex (no se borra el original).
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Motivo (opcional)</Label>
                          <Textarea
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            placeholder="Ej: error en la venta / devolución"
                          />
                        </div>

                        {voidConfirmMessage ? (
                          <Alert>
                            <AlertTitle>Stock insuficiente (modo prueba)</AlertTitle>
                            <AlertDescription>
                              <div className="whitespace-pre-wrap text-sm">{voidConfirmMessage}</div>
                              {Array.isArray(voidConfirmProducts) && voidConfirmProducts.length ? (
                                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  {voidConfirmProducts.slice(0, 10).map((p) => (
                                    <div key={String(p.productId)}>
                                      {p.name ?? `Producto ${p.productId}`}
                                      {p.code ? ` (${p.code})` : ''}
                                      {` · Stock: ${p.stock} · Requerido: ${p.required}`}
                                    </div>
                                  ))}
                                  {voidConfirmProducts.length > 10 ? (
                                    <div>…y {voidConfirmProducts.length - 10} más</div>
                                  ) : null}
                                </div>
                              ) : null}
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        {voidError ? (
                          <Alert variant="destructive">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{voidError}</AlertDescription>
                          </Alert>
                        ) : null}

                        <div className="flex justify-end gap-2 pt-2">
                          <Button type="button" variant="outline" onClick={() => setVoidOpen(false)} disabled={voiding}>
                            Cancelar
                          </Button>
                          {voidConfirmMessage ? (
                            <Button type="button" onClick={handleVoidSelectedConfirmProceed} disabled={voiding}>
                              {voiding ? 'Procesando…' : 'Continuar (dejar stock en 0)'}
                            </Button>
                          ) : (
                            <Button type="button" onClick={handleVoidSelected} disabled={voiding}>
                              {voiding ? 'Anulando…' : 'Anular'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={deleting || !selectedDocumentId || selectedIsFinalized}>
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

              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modificar documento</DialogTitle>
                    <DialogDescription>
                      Solo se modifican documentos NO finalizados (sin impacto en stock/kardex).
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    {detailsMeta.isSalesCategory ? (
                      <div className="space-y-1">
                        <Label>Cliente</Label>
                        <Input
                          value={editThirdPartyName}
                          onChange={(e) => setEditThirdPartyName(e.target.value)}
                          placeholder="Nombre del cliente"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1">
                      <Label>Nota</Label>
                      <Textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Motivo / observaciones"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">Productos</div>

                        <Dialog open={editAddProductOpen} onOpenChange={setEditAddProductOpen}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={editSaving}
                            onClick={() => {
                              setEditAddProductQuery('');
                              setEditAddProductResults([]);
                              setEditAddProductOpen(true);
                            }}
                          >
                            Agregar producto
                          </Button>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Agregar producto</DialogTitle>
                              <DialogDescription>Busca un producto y agrégalo al documento.</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label>Buscar</Label>
                                <Input
                                  value={editAddProductQuery}
                                  onChange={(e) => setEditAddProductQuery(e.target.value)}
                                  placeholder="Nombre, código..."
                                />
                                {editAddProductSearching ? (
                                  <div className="text-xs text-muted-foreground">Buscando…</div>
                                ) : null}
                              </div>

                              <div className="max-h-[340px] overflow-auto rounded-md border">
                                {editAddProductResults.length ? (
                                  <div className="divide-y">
                                    {editAddProductResults.map((p) => {
                                      const label = p.code ? `${p.name} (${p.code})` : p.name;
                                      return (
                                        <button
                                          type="button"
                                          key={String(p.idProduct)}
                                          className="w-full text-left px-3 py-2 hover:bg-muted"
                                          onClick={() => {
                                            const key = `new-${Date.now()}-${p.idProduct}`;
                                            setEditItems((prev) => [
                                              ...prev,
                                              {
                                                key,
                                                productId: Number(p.idProduct),
                                                productName: String(p.name),
                                                productCode: p.code !== undefined && p.code !== null ? String(p.code) : null,
                                                quantity: 1,
                                                price: Number(p.price ?? 0) || 0,
                                                remove: false,
                                              },
                                            ]);
                                            setEditAddProductOpen(false);
                                          }}
                                        >
                                          <div className="text-sm font-medium">{label}</div>
                                          <div className="text-xs text-muted-foreground">
                                            Precio sugerido: {formatMoney(Number(p.price ?? 0) || 0)}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="p-3 text-sm text-muted-foreground">Sin resultados.</div>
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {editItems.length ? (
                        <div className="space-y-2">
                          {editItems.map((it) => {
                            const lineTotal = Math.max(0, Number(it.quantity) || 0) * Math.max(0, Number(it.price) || 0);
                            return (
                              <div
                                key={it.key}
                                className={
                                  "flex flex-col gap-2 rounded-md border p-2 md:flex-row md:items-center md:justify-between " +
                                  (it.remove ? "opacity-60" : "")
                                }
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {it.productName}{it.productCode ? ` (${it.productCode})` : ''}
                                  </div>
                                  {it.remove ? <div className="text-xs text-muted-foreground">Se quitará del documento</div> : null}
                                </div>

                                <div className="flex flex-wrap items-end gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Cantidad</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={String(it.quantity)}
                                      disabled={editSaving || it.remove}
                                      onChange={(e) => {
                                        const next = Number(e.target.value);
                                        setEditItems((prev) =>
                                          prev.map((p) => (p.key === it.key ? { ...p, quantity: Number.isFinite(next) ? next : 0 } : p))
                                        );
                                      }}
                                      className="w-28"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs">Precio</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={String(it.price)}
                                      disabled={editSaving || it.remove}
                                      onChange={(e) => {
                                        const next = Number(e.target.value);
                                        setEditItems((prev) =>
                                          prev.map((p) => (p.key === it.key ? { ...p, price: Number.isFinite(next) ? next : 0 } : p))
                                        );
                                      }}
                                      className="w-28"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs">Total</Label>
                                    <div className="h-10 rounded-md border px-3 flex items-center text-sm">
                                      {formatMoney(lineTotal)}
                                    </div>
                                  </div>

                                  <Button
                                    type="button"
                                    variant={it.remove ? "outline" : "destructive"}
                                    disabled={editSaving}
                                    onClick={() => {
                                      setEditItems((prev) =>
                                        prev.map((p) => (p.key === it.key ? { ...p, remove: !p.remove } : p))
                                      );
                                    }}
                                  >
                                    {it.remove ? "Deshacer" : "Quitar"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Este documento no tiene productos.</div>
                      )}
                    </div>

                    {editError ? (
                      <Alert variant="destructive">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{editError}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                        Cancelar
                      </Button>
                      <Button type="button" onClick={handleSaveEdit} disabled={editSaving}>
                        {editSaving ? "Guardando…" : "Guardar"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="grid gap-2 md:grid-cols-4">
                <div className="text-sm">
                  <div className="text-muted-foreground">
                    {detailsMeta.isSalesCategory ? "Cliente" : detailsMeta.isPurchaseCategory ? "Proveedor" : "Tercero"}
                  </div>
                  <div>{details.customername ?? "-"}</div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">Pago</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={paidStatusVariant(selectedDocRow?.paidStatus ?? details.paidstatus)}>
                      {paidStatusLabelEs(selectedDocRow?.paidStatus ?? details.paidstatus)}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleTogglePaidStatus}
                      disabled={loadingDetails || deleting || voiding || Boolean(voidLinkMeta.isVoidDocument) || Boolean(voidLinkMeta.reversalDocumentId)}
                    >
                      Cambiar
                    </Button>
                  </div>
                  {Boolean(voidLinkMeta.isVoidDocument) || Boolean(voidLinkMeta.reversalDocumentId) ? (
                    <div className="mt-1 text-xs text-muted-foreground">Bloqueado por anulación.</div>
                  ) : null}
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

              {voidLinkMeta.reversalDocumentId ? (
                <Alert>
                  <AlertTitle>Documento anulado</AlertTitle>
                  <AlertDescription>
                    Este documento ya fue anulado. Ver el documento de anulación (ID: {voidLinkMeta.reversalDocumentId}
                    {voidLinkMeta.reversalDocumentNumber ? ` · ${voidLinkMeta.reversalDocumentNumber}` : ''}).
                  </AlertDescription>
                </Alert>
              ) : null}

              {voidLinkMeta.isVoidDocument && voidLinkMeta.originalDocumentId ? (
                <Alert>
                  <AlertTitle>Documento de anulación</AlertTitle>
                  <AlertDescription>
                    Este documento es una anulación del documento original (ID: {voidLinkMeta.originalDocumentId}).
                  </AlertDescription>
                </Alert>
              ) : null}

              {details.note ? (
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Nota</div>
                  <div className="mt-1 text-sm whitespace-pre-wrap">{details.note}</div>
                </div>
              ) : null}

              <div className="rounded-md border p-3">
                <div className="text-sm text-muted-foreground">InternalNote</div>
                {(() => {
                  const raw = String(details.internalnote ?? "").trim();
                  if (!raw) return <div className="text-sm">-</div>;

                  const looksJson = raw.startsWith("{") || raw.startsWith("[");
                  if (!looksJson) return <div className="text-sm whitespace-pre-wrap">{raw}</div>;

                  try {
                    JSON.parse(raw);
                    return (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-sm underline">Ver contenido (JSON)</summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{raw}</pre>
                      </details>
                    );
                  } catch {
                    return <div className="text-sm whitespace-pre-wrap">{raw}</div>;
                  }
                })()}
              </div>

              {(() => {
                const raw = String(details.internalnote ?? "").trim();
                if (!raw || !(raw.startsWith("{") || raw.startsWith("["))) return null;

                try {
                  const parsed = JSON.parse(raw);
                  if (parsed?.source !== 'POS' || parsed?.kind !== 'Sale') return null;
                  const t = parsed?.saleTotals;
                  if (!t) return null;

                  const ivaPct = Number(t?.ivaPercentage ?? 0);
                  const gross = Number(t?.grossTotal ?? 0);
                  const net = Number(t?.netTotal ?? 0);
                  const iva = Number(t?.ivaTotal ?? 0);
                  if (![ivaPct, gross, net, iva].every((n) => Number.isFinite(n))) return null;

                  return (
                    <div className="grid gap-2 rounded-md border p-3">
                      <div className="text-sm font-medium">Venta (Neto / IVA)</div>
                      <div className="grid gap-2 md:grid-cols-4">
                        <div className="text-sm">
                          <div className="text-muted-foreground">IVA (%)</div>
                          <div className="font-medium">{ivaPct.toFixed(2)}%</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-muted-foreground">Total bruto</div>
                          <div className="font-medium">{formatMoney(gross)}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-muted-foreground">Venta neta</div>
                          <div className="font-medium">{formatMoney(net)}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-muted-foreground">IVA incluido</div>
                          <div className="font-medium">{formatMoney(iva)}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Nota: estos valores se guardan en InternalNote para trazabilidad.
                      </div>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}

              {(() => {
                const raw = String(details.internalnote ?? "").trim();
                if (!raw || !(raw.startsWith('{') || raw.startsWith('['))) return null;
                try {
                  const parsed = JSON.parse(raw);
                  const products = parsed?.products;
                  const created = Array.isArray(products?.created) ? products.created : [];
                  const existing = Array.isArray(products?.existing) ? products.existing : [];
                  if (created.length === 0 && existing.length === 0) return null;

                  return (
                    <div className="grid gap-2 rounded-md border p-3">
                      <div className="text-sm font-medium">Productos (en este documento)</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="text-sm">
                          <div className="text-muted-foreground">Nuevos</div>
                          <div className="font-medium">{created.length}</div>
                          {created.length > 0 ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {created
                                .slice(0, 8)
                                .map((p: any) => {
                                  const name = String(p?.name ?? '');
                                  const code = p?.code ? String(p.code) : '';
                                  const id = Number(p?.idProduct ?? 0);
                                  return `${id}${code ? ` · ${code}` : ''}${name ? ` · ${name}` : ''}`;
                                })
                                .join(' | ')}
                              {created.length > 8 ? ' …' : ''}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-sm">
                          <div className="text-muted-foreground">Existentes (reusados)</div>
                          <div className="font-medium">{existing.length}</div>
                          {existing.length > 0 ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {existing
                                .slice(0, 8)
                                .map((p: any) => {
                                  const name = String(p?.name ?? '');
                                  const code = p?.code ? String(p.code) : '';
                                  const id = Number(p?.idProduct ?? 0);
                                  return `${id}${code ? ` · ${code}` : ''}${name ? ` · ${name}` : ''}`;
                                })
                                .join(' | ')}
                              {existing.length > 8 ? ' …' : ''}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Nota: si se detecta un código existente, el sistema reutiliza ese producto para evitar duplicados.
                      </div>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}

              {detailsMeta.isPurchaseCategory && details.documenttypeprinttemplate === 'Purchase' && details.liquidation?.result?.totals && (
                <Card className="border-0 bg-indigo-600 text-white">
                  <CardHeader>
                    <CardTitle className="text-white">Resumen Financiero</CardTitle>
                    <div className="text-xs text-indigo-100">Vista general de costos y ganancias</div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 grid gap-2 rounded-md bg-indigo-900/20 p-3 text-xs text-indigo-100 md:grid-cols-4">
                      <div>
                        <div className="opacity-80">IVA (%)</div>
                        <div className="font-semibold text-white">{Number(details.liquidation.config.ivaPercentage ?? 0).toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="opacity-80">IVA incluido en costo</div>
                        <div className="font-semibold text-white">{details.liquidation.config.ivaIncludedInCost ? 'Sí' : 'No'}</div>
                      </div>
                      <div>
                        <div className="opacity-80">Descuentos</div>
                        <div className="font-semibold text-white">{details.liquidation.config.discountsEnabled ? 'Sí' : 'No'}</div>
                      </div>
                      <div>
                        <div className="opacity-80">Fletes múltiples</div>
                        <div className="font-semibold text-white">{details.liquidation.config.useMultipleFreights ? 'Sí' : 'No'}</div>
                      </div>
                      {Array.isArray(details.liquidation.config.freightRates) && details.liquidation.config.freightRates.length > 0 ? (
                        <div className="md:col-span-4">
                          <div className="opacity-80">Fletes configurados</div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            {details.liquidation.config.freightRates.map((f: any) => (
                              <div key={String(f.id)} className="text-white">
                                {String(f.name ?? f.id)}: <span className="font-semibold">{formatMoney(Number(f.cost ?? 0))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

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

              {detailsMeta.isPurchaseCategory ? (
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
                        const freightRate =
                          details.liquidation?.config?.freightRates?.find((f: any) => String(f.id) === freightId) ??
                          (!details.liquidation?.config?.useMultipleFreights
                            ? details.liquidation?.config?.freightRates?.[0]
                            : null);

                        const freightName = freightRate?.name ? String(freightRate.name) : '';
                        const freightCost =
                          freightRate?.cost !== undefined && freightRate?.cost !== null ? Number(freightRate.cost) : 0;
                        const freightLabel =
                          freightName ? `${freightName}${freightCost ? ` (${formatMoney(freightCost)})` : ''}` : '—';

                        return (
                          <TableRow key={it.id}>
                            <TableCell>{it.id}</TableCell>
                            <TableCell>{it.productname}</TableCell>
                            <TableCell className="text-muted-foreground">{it.productcode ?? "—"}</TableCell>
                            <TableCell className="text-right">{it.quantity}</TableCell>
                            <TableCell className="text-right">{formatMoney(it.unitcost)}</TableCell>
                            <TableCell className="text-right">{formatMoney(unitFreight)}</TableCell>
                            <TableCell>{freightLabel}</TableCell>
                            <TableCell className="text-right">{formatMoney(unitFinalCost)}</TableCell>
                            <TableCell className="text-right">{formatMoney(unitSale)}</TableCell>
                            <TableCell className="text-right">{formatMoney(totalSale)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => openProductDetails(it.productid)}>
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">ID</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio unit.</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground">
                          Sin items.
                        </TableCell>
                      </TableRow>
                    ) : (
                      details.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>{it.id}</TableCell>
                          <TableCell>{it.productname}</TableCell>
                          <TableCell className="text-muted-foreground">{it.productcode ?? "—"}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">{formatMoney(it.price)}</TableCell>
                          <TableCell className="text-right">{formatMoney(it.taxamount ?? 0)}</TableCell>
                          <TableCell className="text-right">{formatMoney(it.total)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => openProductDetails(it.productid)}>
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de producto</DialogTitle>
            <DialogDescription>
              {details?.customername ? `Tercero: ${details.customername}` : ""}
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
