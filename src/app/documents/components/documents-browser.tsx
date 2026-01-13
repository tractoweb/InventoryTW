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
import { Terminal } from "lucide-react";

import { useDebounce } from "@/hooks/use-debounce";
import { listDocuments, type DocumentListRow } from "@/actions/list-documents";
import { getDocumentDetails, type DocumentDetails } from "@/actions/get-document-details";
import { getCustomers, type CustomerListItem } from "@/actions/get-customers";
import { getWarehouses, type WarehouseListItem } from "@/actions/get-warehouses";
import { getDocumentTypes, type DocumentTypeListItem } from "@/actions/get-document-types";

type Option = { value: string; label: string };

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
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);

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
        limit: 200,
      });

      if (result.error) {
        setDocs([]);
        setError(result.error);
      } else {
        setDocs(result.data ?? []);
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
    refreshDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, dateFrom, dateTo, customerId, warehouseId, documentTypeId]);

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

  const clearFilters = () => {
    setQ("");
    setCustomerId("all");
    setWarehouseId("all");
    setDocumentTypeId("all");
  };

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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, referencia u orden" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Proveedor</div>
            <Select value={customerId} onValueChange={setCustomerId}>
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
            <Select value={warehouseId} onValueChange={setWarehouseId}>
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
            <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
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
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Hasta</div>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
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
                  docs.map((d) => (
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
