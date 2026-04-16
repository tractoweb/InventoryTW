export type ExportFormat = "csv" | "xml" | "pdf";

export type ExportScope = "filtered" | "all";

export type ExportFieldLevel = "basic" | "extended" | "stock";

export type InventoryExportFieldKey =
  | "id"
  | "code"
  | "name"
  | "productGroupName"
  | "measurementUnit"
  | "cost"
  | "price"
  | "lastPurchasePrice"
  | "marginPct"
  | "isEnabled"
  | "createdAt"
  | "updatedAt"
  | "supplierNames"
  | "lastSupplierName"
  | "lastDocumentNumber"
  | "lastDocumentDate"
  | "stockTotal"
  | "stockByWarehouse";

export type InventoryExportFieldDefinition = {
  key: InventoryExportFieldKey;
  label: string;
  xmlTag: string;
  level: ExportFieldLevel;
  description?: string;
};

export type InventoryExportStockWarehouse = {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
};

export type InventoryExportRow = {
  id: number;
  code: string | null;
  name: string;
  productGroupName: string | null;
  measurementUnit: string | null;
  cost: number | null;
  price: number | null;
  lastPurchasePrice: number | null;
  marginPct: number | null;
  isEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  supplierIds: number[];
  supplierNames: string[];
  lastSupplierName: string | null;
  lastDocumentNumber: string | null;
  lastDocumentDate: string | null;
  stockTotal: number | null;
  stockByWarehouse: InventoryExportStockWarehouse[];
};

export const INVENTORY_EXPORT_FIELDS: InventoryExportFieldDefinition[] = [
  { key: "name", label: "Nombre", xmlTag: "Nombre", level: "basic" },
  { key: "code", label: "Referencia", xmlTag: "Referencia", level: "basic" },
  { key: "measurementUnit", label: "Colocación", xmlTag: "Colocacion", level: "basic" },
  { key: "productGroupName", label: "Grupo", xmlTag: "Grupo", level: "basic" },
  { key: "price", label: "Precio", xmlTag: "Precio", level: "basic" },
  { key: "cost", label: "Costo", xmlTag: "Costo", level: "basic" },
  { key: "id", label: "ID", xmlTag: "ID", level: "extended" },
  { key: "lastPurchasePrice", label: "Último precio compra", xmlTag: "UltimoPrecioCompra", level: "extended" },
  { key: "marginPct", label: "Margen %", xmlTag: "Margen", level: "extended" },
  { key: "isEnabled", label: "Activo", xmlTag: "Activo", level: "extended" },
  { key: "createdAt", label: "Creado", xmlTag: "Creado", level: "extended" },
  { key: "updatedAt", label: "Actualizado", xmlTag: "Actualizado", level: "extended" },
  { key: "supplierNames", label: "Proveedores", xmlTag: "Proveedores", level: "extended" },
  { key: "lastSupplierName", label: "Último proveedor", xmlTag: "UltimoProveedor", level: "extended" },
  { key: "lastDocumentNumber", label: "Último documento", xmlTag: "UltimoDocumento", level: "extended" },
  { key: "lastDocumentDate", label: "Fecha último documento", xmlTag: "FechaUltimoDocumento", level: "extended" },
  {
    key: "stockTotal",
    label: "Stock total",
    xmlTag: "StockTotal",
    level: "stock",
    description: "Suma el stock de todos los almacenes",
  },
  {
    key: "stockByWarehouse",
    label: "Stock por almacén",
    xmlTag: "Existencias",
    level: "stock",
    description: "Desglosa las existencias por almacén",
  },
];

export const DEFAULT_INVENTORY_EXPORT_FIELDS: InventoryExportFieldKey[] = [
  "name",
  "code",
  "measurementUnit",
  "productGroupName",
  "price",
  "cost",
];