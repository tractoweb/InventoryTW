/**
 * Tipos para sistema de trazabilidad y deduplicación de productos
 */

// Razones de deshabilitación
export type DisabledReason =
  | "Accidental"
  | "Duplicate"
  | "Obsolete"
  | "Temporary"
  | "Voided"
  | "MERGED_WITH_PRIMARY"
  | "MANUAL_DISABLE"
  | "UNKNOWN";

// Tipo de coincidencia en duplicados
export type MatchType = "EXACT_CODE" | "EXACT_NAME" | "FUZZY_NAME" | "BARCODE";

// Estado de candidato a duplicado
export type DuplicateStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "MERGED";

// Registro de historial de deshabilitación
export interface DisabledEntityHistoryRecord {
  historyId: string;
  entityType: "Product" | "Document" | "User" | "Customer" | "Client";
  entityId: number;
  reason: string;
  disabledBy: number;
  disabledAt: string;
  reenabledBy?: number | null;
  reenabledAt?: string | null;
  reenableReason?: string | null;
  tags?: string[];
  notes?: string | null;
}

// Candidato a duplicado
export interface ProductDuplicateCandidateRecord {
  candidateId: string;
  primaryProductId: number;
  duplicateProductId: number;
  matchType: MatchType;
  confidence: number; // 0.0 - 1.0
  detectedAt: string;
  detectedBy: string;
  status: DuplicateStatus;
  reason?: string | null;
  notes?: string | null;
}

// Historial de fusión de productos
export interface ProductMergeHistoryRecord {
  mergeId: string;
  primaryProductId: number;
  duplicateProductId: number;
  mergedBy: number;
  mergedAt: string;
  barcodesMerged: number;
  commentsMerged: number;
  stockControlsMerged: number;
  notes?: string | null;
  reversible: boolean;
}

// Producto con información de trazabilidad
export interface ProductWithTraceability {
  id: number;
  name: string;
  code: string | null;
  isEnabled: boolean;
  disabledReason?: string | null;
  disabledAt?: string | null;
  lastEnabledAt?: string | null;
  mergedIntoProductId?: number | null;
  duplicateGroupId?: number | null;
  stock: number;
  documentCount: number;
  kardexCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// Filtros avanzados para maestro de productos
export interface ProductFilters {
  // Búsqueda
  search?: string;
  groupId?: number;

  // Estado
  states?: Array<"active" | "disabled" | "merged">;

  // Códigos
  showOnlyWithCode?: boolean;
  showDuplicates?: boolean;
  showDuplicateCandidates?: boolean;
  duplicateCode?: string;
  showNoBarcode?: boolean;

  // Inventario
  stockFilter?: "all" | "with" | "without" | "low";
  warehouseId?: number;
  stockMin?: number;
  stockMax?: number;
  showNegativeStock?: boolean;

  // Financiero
  priceMin?: number;
  priceMax?: number;
  costMin?: number;
  costMax?: number;
  markupMin?: number;
  markupMax?: number;
  showNoPrice?: boolean;
  showNoCost?: boolean;

  // Documentos y Kardex
  documentRange?: "any" | "none" | "less5" | "5to20" | "more20";
  kardexPeriod?: "7days" | "30days" | "90days" | "all";
  showNoKardex?: boolean;
  showNoRecentMovements?: boolean;

  // Configuración
  includeServices?: boolean;
  showNoComments?: boolean;
  showNoTaxAssigned?: boolean;

  // Deshabilitación
  disabledReason?: DisabledReason | "all";
  disabledPeriod?: "7days" | "30days" | "90days" | "all";
  disabledBy?: number;
  showAccidentallyDisabled?: boolean;
  showCandidatesToMerge?: boolean;
  showMerged?: boolean;

  // Paginación
  page?: number;
  pageSize?: number;
}

// Vista guardada de filtros
export interface SavedFilterView {
  id: string;
  name: string;
  filters: ProductFilters;
  createdBy: number;
  createdAt: string;
  isDefault?: boolean;
}

// Resultado de operación de merge
export interface MergeResult {
  success: boolean;
  mergeId?: string;
  message?: string;
  error?: string;
  barcodesMerged?: number;
  commentsMerged?: number;
  stockControlsMerged?: number;
}

// Estadísticas de deshabilitaciones
export interface DisabledProductsStats {
  totalDisabled: number;
  byReason: Record<string, number>;
  accidentalCount: number;
  duplicateCount: number;
  last7Days: number;
  last30Days: number;
}

// Estado de columnas para tabla
export interface TableColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  width?: string;
}

// Acción masiva en productos
export type BulkAction = "merge" | "disable" | "enable" | "mark_for_delete" | "export";

export interface BulkActionRequest {
  action: BulkAction;
  productIds: number[];
  metadata?: Record<string, any>;
}
