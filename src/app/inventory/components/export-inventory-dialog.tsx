"use client";

import * as React from "react";

import { ArrowDown, ArrowUp, Database, Download } from "lucide-react";

import { exportAllDbAction } from "@/actions/export-all-db";
import { getCustomers, type CustomerListItem } from "@/actions/get-customers";
import { getExportProductContext } from "@/actions/get-export-product-context";
import { getExportStockDetails } from "@/actions/get-export-stock-details";
import type { ProductGroup } from "@/actions/get-product-groups";
import type { Warehouse } from "@/actions/get-warehouses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  buildInventoryCsv,
  buildInventoryJson,
  buildInventoryPdf,
  buildInventoryWorkbook,
  buildInventoryXml,
  buildRecordsCsv,
  buildRecordsXml,
} from "@/lib/export-formatters";
import {
  type CsvDelimiter,
  DEFAULT_INVENTORY_EXPORT_FIELDS,
  INVENTORY_EXPORT_FIELDS,
  type ExportFormat,
  type ExportScope,
  type InventoryExportFieldDefinition,
  type InventoryExportFieldKey,
  type InventoryExportRow,
} from "@/types/export.types";

import type { ProductsMasterTableRow } from "./products-master-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filteredRows: ProductsMasterTableRow[];
  allRows: ProductsMasterTableRow[];
  productGroups: ProductGroup[];
  warehouses: Warehouse[];
  currentQuery: string;
  currentGroupName?: string | null;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function createExportRows(
  rows: ProductsMasterTableRow[],
  warehouses: Warehouse[],
  stockDetails: Awaited<ReturnType<typeof getExportStockDetails>>["data"],
  contexts: Awaited<ReturnType<typeof getExportProductContext>>["data"]
): InventoryExportRow[] {
  const warehouseNameById = new Map<number, string>();
  for (const warehouse of warehouses) {
    const id = Number((warehouse as any)?.id ?? (warehouse as any)?.idWarehouse);
    if (!Number.isFinite(id) || id <= 0) continue;
    warehouseNameById.set(id, String((warehouse as any)?.name ?? `Almacén ${id}`));
  }

  const stockByProductId = new Map(stockDetails.map((detail) => [detail.productId, detail]));
  const contextByProductId = new Map(contexts.map((detail) => [detail.productId, detail]));

  return rows.map((row) => {
    const cost = row.cost !== null && row.cost !== undefined ? Number(row.cost) : null;
    const price = row.price !== null && row.price !== undefined ? Number(row.price) : null;
    const marginPct = cost && Number.isFinite(cost) && cost > 0 && price && Number.isFinite(price)
      ? ((price - cost) / cost) * 100
      : null;
    const stockDetail = stockByProductId.get(Number(row.id));
    const context = contextByProductId.get(Number(row.id));
    return {
      id: Number(row.id),
      code: row.code ?? null,
      name: row.name,
      productGroupName: row.productGroupName ?? null,
      measurementUnit: row.measurementUnit ?? null,
      cost,
      price,
      lastPurchasePrice: context?.lastPurchasePrice ?? null,
      marginPct,
      isEnabled: row.isEnabled !== false,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
      supplierIds: context?.supplierIds ?? [],
      supplierNames: context?.supplierNames ?? [],
      lastSupplierName: context?.lastSupplierName ?? null,
      lastDocumentNumber: context?.lastDocumentNumber ?? null,
      lastDocumentDate: context?.lastDocumentDate ?? null,
      stockTotal: stockDetail?.stockTotal ?? 0,
      stockByWarehouse: (stockDetail?.stockByWarehouse ?? []).map((item) => ({
        warehouseId: item.warehouseId,
        warehouseName: warehouseNameById.get(item.warehouseId) ?? `Almacén ${item.warehouseId}`,
        quantity: Number(item.quantity ?? 0),
      })),
    };
  });
}

export function ExportInventoryDialog({
  open,
  onOpenChange,
  filteredRows,
  allRows,
  productGroups,
  warehouses,
  currentQuery,
  currentGroupName,
}: Props) {
  const { toast } = useToast();
  const [scope, setScope] = React.useState<ExportScope>("filtered");
  const [format, setFormat] = React.useState<ExportFormat>("csv");
  const [selectedFields, setSelectedFields] = React.useState<InventoryExportFieldKey[]>(DEFAULT_INVENTORY_EXPORT_FIELDS);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isPreparingData, setIsPreparingData] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<CustomerListItem[]>([]);
  const [stockDetails, setStockDetails] = React.useState<Awaited<ReturnType<typeof getExportStockDetails>>["data"]>([]);
  const [productContexts, setProductContexts] = React.useState<Awaited<ReturnType<typeof getExportProductContext>>["data"]>([]);
  const [nameFilter, setNameFilter] = React.useState("");
  const [selectedGroupId, setSelectedGroupId] = React.useState<string>("all");
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("all");
  const [stockExact, setStockExact] = React.useState("");
  const [stockMin, setStockMin] = React.useState("");
  const [stockMax, setStockMax] = React.useState("");
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [createdTo, setCreatedTo] = React.useState("");
  const [createdYear, setCreatedYear] = React.useState("");
  const [csvDelimiter, setCsvDelimiter] = React.useState<CsvDelimiter>(";");
  const [isExportingDb, setIsExportingDb] = React.useState(false);
  const [fullDbFormat, setFullDbFormat] = React.useState<Extract<ExportFormat, "csv" | "xml" | "json">>("json");

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function prepare() {
      setIsPreparingData(true);
      try {
        const productIds = allRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
        const [suppliersRes, stockRes, contextRes] = await Promise.all([
          getCustomers({ onlyEnabled: true, onlySuppliers: true }),
          getExportStockDetails({ productIds }),
          getExportProductContext({ productIds }),
        ]);

        if (cancelled) return;

        if (suppliersRes.error) {
          toast({ variant: "destructive", title: "No se pudieron cargar proveedores", description: suppliersRes.error });
        } else {
          setSuppliers(suppliersRes.data ?? []);
        }

        if (stockRes.error) {
          toast({ variant: "destructive", title: "No se pudo cargar stock para filtros", description: stockRes.error });
          setStockDetails([]);
        } else {
          setStockDetails(stockRes.data ?? []);
        }

        if (contextRes.error) {
          toast({ variant: "destructive", title: "No se pudo cargar contexto documental", description: contextRes.error });
          setProductContexts([]);
        } else {
          setProductContexts(contextRes.data ?? []);
        }
      } finally {
        if (!cancelled) setIsPreparingData(false);
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [open, allRows, toast]);

  const exportRows = React.useMemo(
    () => createExportRows(allRows, warehouses, stockDetails, productContexts),
    [allRows, warehouses, stockDetails, productContexts]
  );

  const baseRows = React.useMemo(() => {
    const source = scope === "all" ? allRows : filteredRows;
    const sourceIds = new Set(source.map((row) => Number(row.id)));
    return exportRows.filter((row) => sourceIds.has(Number(row.id)));
  }, [scope, allRows, filteredRows, exportRows]);

  const sourceRows = React.useMemo(() => {
    const normalizedName = String(nameFilter ?? "").trim().toLowerCase();
    const exactStock = stockExact.trim() === "" ? null : Number(stockExact);
    const minStock = stockMin.trim() === "" ? null : Number(stockMin);
    const maxStock = stockMax.trim() === "" ? null : Number(stockMax);
    const fromTime = createdFrom ? new Date(`${createdFrom}T00:00:00`).getTime() : null;
    const toTime = createdTo ? new Date(`${createdTo}T23:59:59`).getTime() : null;
    const yearNumber = createdYear.trim() === "" ? null : Number(createdYear);
    const groupId = selectedGroupId === "all" ? null : Number(selectedGroupId);
    const supplierId = selectedSupplierId === "all" ? null : Number(selectedSupplierId);

    return baseRows.filter((row) => {
      if (normalizedName) {
        const haystack = `${row.name} ${row.code ?? ""}`.toLowerCase();
        if (!haystack.includes(normalizedName)) return false;
      }

      if (groupId && Number.isFinite(groupId)) {
        const group = productGroups.find((item) => Number(item.id) === groupId);
        if (!group || String(row.productGroupName ?? "") !== String(group.name ?? "")) return false;
      }

      if (supplierId && Number.isFinite(supplierId) && !row.supplierIds.includes(supplierId)) return false;

      if (exactStock !== null && Number.isFinite(exactStock) && Number(row.stockTotal ?? 0) !== exactStock) return false;
      if (exactStock === null && minStock !== null && Number.isFinite(minStock) && Number(row.stockTotal ?? 0) < minStock) return false;
      if (exactStock === null && maxStock !== null && Number.isFinite(maxStock) && Number(row.stockTotal ?? 0) > maxStock) return false;

      if (fromTime !== null || toTime !== null || (yearNumber !== null && Number.isFinite(yearNumber))) {
        const createdTime = row.createdAt ? new Date(row.createdAt).getTime() : null;
        if (!createdTime || !Number.isFinite(createdTime)) return false;
        if (fromTime !== null && createdTime < fromTime) return false;
        if (toTime !== null && createdTime > toTime) return false;
        if (yearNumber !== null && Number.isFinite(yearNumber) && new Date(createdTime).getFullYear() !== yearNumber) return false;
      }

      return true;
    });
  }, [
    baseRows,
    nameFilter,
    selectedGroupId,
    selectedSupplierId,
    stockExact,
    stockMin,
    stockMax,
    createdFrom,
    createdTo,
    createdYear,
    productGroups,
  ]);

  const selectedFieldDefinitions = React.useMemo(() => {
    const definitionsByKey = new Map(INVENTORY_EXPORT_FIELDS.map((field) => [field.key, field]));
    return selectedFields
      .map((fieldKey) => definitionsByKey.get(fieldKey))
      .filter((field): field is InventoryExportFieldDefinition => Boolean(field));
  }, [selectedFields]);

  const toggleField = React.useCallback((fieldKey: InventoryExportFieldKey, checked: boolean) => {
    setSelectedFields((prev) => {
      if (checked) {
        if (prev.includes(fieldKey)) return prev;
        return [...prev, fieldKey];
      }
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item !== fieldKey);
    });
  }, []);

  const moveField = React.useCallback((fieldKey: InventoryExportFieldKey, direction: -1 | 1) => {
    setSelectedFields((prev) => {
      const index = prev.indexOf(fieldKey);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }, []);

  async function handleExport() {
    if (selectedFields.length === 0) {
      toast({ variant: "destructive", title: "Selecciona al menos un campo" });
      return;
    }

    if (sourceRows.length === 0) {
      toast({ variant: "destructive", title: "No hay datos para exportar" });
      return;
    }

    setIsExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const scopeLabel = scope === "all" ? "Toda la base" : "Solo filtrado";
      const filterLabel = [
        currentGroupName ? `Grupo actual: ${currentGroupName}` : null,
        currentQuery ? `Búsqueda actual: ${currentQuery}` : null,
        nameFilter ? `Nombre/ref: ${nameFilter}` : null,
        selectedGroupId !== "all" ? `Grupo exportación: ${productGroups.find((item) => String(item.id) === selectedGroupId)?.name ?? selectedGroupId}` : null,
        selectedSupplierId !== "all" ? `Proveedor: ${suppliers.find((item) => String(item.idCustomer) === selectedSupplierId)?.name ?? selectedSupplierId}` : null,
        stockExact ? `Stock exacto: ${stockExact}` : null,
        !stockExact && stockMin ? `Stock mín: ${stockMin}` : null,
        !stockExact && stockMax ? `Stock máx: ${stockMax}` : null,
        createdFrom ? `Desde: ${createdFrom}` : null,
        createdTo ? `Hasta: ${createdTo}` : null,
        createdYear ? `Año: ${createdYear}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const exportMetadata = { scopeLabel, filterLabel };

      if (format === "csv") {
        downloadBlob(buildInventoryCsv(sourceRows, selectedFieldDefinitions, { delimiter: csvDelimiter, decimalSeparator: csvDelimiter === ";" ? "," : "." }), `inventario-${scope}-${stamp}.csv`);
      } else if (format === "xml") {
        downloadBlob(
          buildInventoryXml(sourceRows, selectedFieldDefinitions, exportMetadata),
          `inventario-${scope}-${stamp}.xml`
        );
      } else if (format === "json") {
        downloadBlob(buildInventoryJson(sourceRows, selectedFieldDefinitions, exportMetadata), `inventario-${scope}-${stamp}.json`);
      } else if (format === "xlsx") {
        const workbookBlob = await buildInventoryWorkbook(sourceRows, selectedFieldDefinitions);
        downloadBlob(workbookBlob, `inventario-${scope}-${stamp}.xlsx`);
      } else {
        const subtitle = `${scopeLabel}${filterLabel ? ` · ${filterLabel}` : ""}`;
        const pdfBlob = await buildInventoryPdf(sourceRows, selectedFieldDefinitions, "Exportación de inventario", subtitle);
        downloadBlob(pdfBlob, `inventario-${scope}-${stamp}.pdf`);
      }

      toast({ title: "Exportación generada", description: `${sourceRows.length} productos exportados.` });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "No se pudo exportar", description: error?.message ?? "Error desconocido" });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportAllDb() {
    setIsExportingDb(true);
    try {
      const result = await exportAllDbAction();
      
      // Validate result structure
      if (!result || typeof result !== "object") {
        toast({ variant: "destructive", title: "No se pudo exportar la base", description: "Respuesta inválida del servidor" });
        return;
      }

      if (result.error) {
        toast({ variant: "destructive", title: "No se pudo exportar la base", description: result.error });
        return;
      }

      if (!result.data || typeof result.data !== "object" || Object.keys(result.data).length === 0) {
        toast({ variant: "destructive", title: "No se pudo exportar la base", description: "No se obtuvieron datos del servidor" });
        return;
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const generatedAt = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

      zip.file("metadata.json", JSON.stringify(result.meta ?? {}, null, 2));

      for (const [tableName, rawRows] of Object.entries(result.data)) {
        const rows = Array.isArray(rawRows) ? (rawRows as Record<string, unknown>[]) : [];
        if (rows.length === 0) continue; // Skip empty tables
        
        if (fullDbFormat === "json") {
          zip.file(`${tableName}.json`, JSON.stringify(rows, null, 2));
        } else if (fullDbFormat === "csv") {
          const blob = buildRecordsCsv(rows, { delimiter: csvDelimiter, decimalSeparator: csvDelimiter === ";" ? "," : "." });
          zip.file(`${tableName}.csv`, await blob.text());
        } else {
          const blob = buildRecordsXml(tableName, rows);
          zip.file(`${tableName}.xml`, await blob.text());
        }
      }

      const zipped = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipped, `inventorytw-db-${fullDbFormat}-${generatedAt}.zip`);
      
      const totalTables = Object.keys(result.data).length;
      const failedCount = result.meta?.failedTables?.length ?? 0;
      const successCount = totalTables - failedCount;
      
      toast({ 
        title: "Exportación completa generada", 
        description: failedCount > 0 
          ? `Se exportaron ${successCount} tablas. ${failedCount} tablas fallaron.`
          : `Se exportaron ${totalTables} tablas.`
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({ variant: "destructive", title: "Falló la exportación completa", description: error?.message ?? "Error desconocido" });
    } finally {
      setIsExportingDb(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto overscroll-y-contain">
        <DialogHeader>
          <DialogTitle>Exportar inventario</DialogTitle>
          <DialogDescription>
            Elige el formato, el alcance y el orden de los campos. También puedes exportar toda la base del sistema en un ZIP por tablas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-4 min-w-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Alcance y formato</CardTitle>
                <CardDescription>La exportación respeta el filtro actual cuando eliges "Solo filtrado".</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Qué exportar</Label>
                  <RadioGroup value={scope} onValueChange={(value) => setScope(value as ExportScope)}>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="filtered" id="export-scope-filtered" />
                      <span>Solo filtrado</span>
                      <Badge variant="secondary" className="ml-auto">{filteredRows.length}</Badge>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="all" id="export-scope-all" />
                      <span>Toda la base</span>
                      <Badge variant="secondary" className="ml-auto">{allRows.length}</Badge>
                    </label>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>Formato</Label>
                  <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="csv" id="export-format-csv" />
                      <span>CSV</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="xml" id="export-format-xml" />
                      <span>XML</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="pdf" id="export-format-pdf" />
                      <span>PDF</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="xlsx" id="export-format-xlsx" />
                      <span>Excel</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="json" id="export-format-json" />
                      <span>JSON</span>
                    </label>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Opciones CSV</CardTitle>
                <CardDescription>Define el carácter separador para que Excel lo abra correctamente en tu entorno.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Separador de celdas</Label>
                  <RadioGroup value={csvDelimiter} onValueChange={(value) => setCsvDelimiter(value as CsvDelimiter)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value=";" id="csv-delimiter-semicolon" />
                      <span>Punto y coma</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="," id="csv-delimiter-comma" />
                      <span>Coma</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="|" id="csv-delimiter-pipe" />
                      <span>Pipe</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="\t" id="csv-delimiter-tab" />
                      <span>Tab</span>
                    </label>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filtros avanzados</CardTitle>
                <CardDescription>Acota por proveedor, stock, grupo, nombre o fecha antes de exportar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="export-name-filter">Nombre o referencia</Label>
                    <Input id="export-name-filter" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Ej. rodamiento, 51109" />
                  </div>
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                      <option value="all">Todos los grupos</option>
                      {productGroups.map((group) => (
                        <option key={group.id} value={String(group.id)}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Proveedor</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      disabled={isPreparingData}
                    >
                      <option value="all">Todos los proveedores</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.idCustomer} value={String(supplier.idCustomer)}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="stock-exact">Stock exacto</Label>
                    <Input id="stock-exact" inputMode="numeric" value={stockExact} onChange={(e) => setStockExact(e.target.value)} placeholder="0, 1, 2..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock-min">Stock mínimo</Label>
                    <Input id="stock-min" inputMode="numeric" value={stockMin} onChange={(e) => setStockMin(e.target.value)} placeholder="Desde" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock-max">Stock máximo</Label>
                    <Input id="stock-max" inputMode="numeric" value={stockMax} onChange={(e) => setStockMax(e.target.value)} placeholder="Hasta" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="created-from">Fecha desde</Label>
                    <Input id="created-from" type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="created-to">Fecha hasta</Label>
                    <Input id="created-to" type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="created-year">Año</Label>
                    <Input id="created-year" inputMode="numeric" value={createdYear} onChange={(e) => setCreatedYear(e.target.value)} placeholder="2026" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Campos disponibles</CardTitle>
                <CardDescription>Los básicos cubren nombre, referencia, colocación, grupos y precios. Los ampliados agregan fechas, proveedor y documentos.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[320px] pr-4">
                  <div className="space-y-4">
                    {(["basic", "extended", "stock"] as const).map((level) => {
                      const items = INVENTORY_EXPORT_FIELDS.filter((field) => field.level === level);
                      const title = level === "basic" ? "Básicos" : level === "extended" ? "Ampliados" : "Stock";
                      return (
                        <div key={level} className="space-y-2">
                          <div className="text-sm font-medium">{title}</div>
                          <div className="space-y-2">
                            {items.map((field) => {
                              const checked = selectedFields.includes(field.key);
                              return (
                                <label key={field.key} className="flex items-start gap-3 rounded-md border p-3">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => toggleField(field.key, value === true)}
                                    aria-label={field.label}
                                  />
                                  <div className="space-y-1">
                                    <div className="text-sm font-medium">{field.label}</div>
                                    {field.description ? (
                                      <div className="text-xs text-muted-foreground">{field.description}</div>
                                    ) : null}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card className="min-h-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Orden de columnas</CardTitle>
              <CardDescription>Este orden se respeta en CSV, XML, JSON, PDF y Excel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScrollArea className="h-[430px] pr-4">
                <div className="space-y-2">
                  {selectedFieldDefinitions.map((field, index) => (
                    <div key={field.key} className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{field.label}</div>
                        <div className="text-xs text-muted-foreground">{field.level === "basic" ? "Básico" : field.level === "extended" ? "Ampliado" : "Stock"}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => moveField(field.key, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => moveField(field.key, 1)}
                          disabled={index === selectedFieldDefinitions.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator />

              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                <div>Productos a exportar: <span className="font-medium text-foreground">{sourceRows.length}</span></div>
                <div>Base previa al filtro avanzado: <span className="font-medium text-foreground">{baseRows.length}</span></div>
                <div>Filtro actual: <span className="font-medium text-foreground">{currentGroupName ?? "Todos los grupos"}</span></div>
                <div>Búsqueda: <span className="font-medium text-foreground">{currentQuery || "Sin término"}</span></div>
                {isPreparingData ? <div>Preparando contexto documental y stock…</div> : null}
              </div>

              <Button type="button" className="w-full" onClick={handleExport} disabled={isExporting || isPreparingData || selectedFields.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Generando exportación…" : `Descargar ${format.toUpperCase()}`}
              </Button>

              <Separator />

              <div className="space-y-3 rounded-md border border-dashed p-3">
                <div>
                  <div className="text-sm font-medium">Exportar toda la DB</div>
                  <div className="text-xs text-muted-foreground">
                    Extrae todas las tablas del sistema en un archivo comprimido. Prioriza JSON, pero también soporta CSV y XML por tabla.
                  </div>
                </div>

                <RadioGroup value={fullDbFormat} onValueChange={(value) => setFullDbFormat(value as Extract<ExportFormat, "csv" | "xml" | "json">)} className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem value="json" id="full-db-format-json" />
                    <span>JSON</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem value="csv" id="full-db-format-csv" />
                    <span>CSV</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem value="xml" id="full-db-format-xml" />
                    <span>XML</span>
                  </label>
                </RadioGroup>

                <Button type="button" variant="secondary" className="w-full" onClick={handleExportAllDb} disabled={isExportingDb}>
                  <Database className="mr-2 h-4 w-4" />
                  {isExportingDb ? "Empaquetando toda la base…" : `Exportar toda la DB (${fullDbFormat.toUpperCase()})`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}