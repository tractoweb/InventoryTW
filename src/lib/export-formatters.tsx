"use client";

import * as React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import type {
  CsvDelimiter,
  InventoryExportFieldDefinition,
  InventoryExportFieldKey,
  InventoryExportRow,
} from "@/types/export.types";

export type CsvExportOptions = {
  delimiter?: CsvDelimiter;
  includeBom?: boolean;
  decimalSeparator?: "." | ",";
};

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNumber(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDecimal(value: number, decimalSeparator: "." | ","): string {
  if (!Number.isFinite(value)) return "";
  const normalized = String(value);
  return decimalSeparator === "," ? normalized.replace(/\./g, ",") : normalized;
}

export function getInventoryFieldRawValue(row: InventoryExportRow, key: InventoryExportFieldKey): string | number | boolean | null {
  switch (key) {
    case "id":
      return row.id;
    case "name":
      return row.name;
    case "code":
      return row.code ?? null;
    case "productGroupName":
      return row.productGroupName ?? null;
    case "measurementUnit":
      return row.measurementUnit ?? null;
    case "cost":
      return row.cost;
    case "price":
      return row.price;
    case "lastPurchasePrice":
      return row.lastPurchasePrice;
    case "marginPct":
      return row.marginPct;
    case "isEnabled":
      return row.isEnabled;
    case "createdAt":
      return row.createdAt;
    case "updatedAt":
      return row.updatedAt;
    case "supplierNames":
      return row.supplierNames.join(" | ");
    case "lastSupplierName":
      return row.lastSupplierName ?? null;
    case "lastDocumentNumber":
      return row.lastDocumentNumber ?? null;
    case "lastDocumentDate":
      return row.lastDocumentDate ?? null;
    case "stockTotal":
      return row.stockTotal;
    case "stockByWarehouse":
      return row.stockByWarehouse.map((item) => `${item.warehouseName}: ${item.quantity}`).join(" | ");
    default:
      return null;
  }
}

export function getInventoryFieldValue(row: InventoryExportRow, key: InventoryExportFieldKey, mode: "display" | "raw" = "display"): string {
  const rawValue = getInventoryFieldRawValue(row, key);
  if (mode === "raw") {
    return rawValue === null || rawValue === undefined ? "" : String(rawValue);
  }

  switch (key) {
    case "cost":
    case "price":
    case "lastPurchasePrice":
      return formatMoney(Number(rawValue ?? 0));
    case "marginPct":
      return rawValue === null ? "" : `${formatNumber(Number(rawValue ?? 0))}%`;
    case "isEnabled":
      return rawValue ? "Sí" : "No";
    case "createdAt":
    case "updatedAt":
    case "lastDocumentDate":
      return formatDate(typeof rawValue === "string" ? rawValue : null);
    case "stockTotal":
      return formatNumber(Number(rawValue ?? 0));
    case "stockByWarehouse":
      return row.stockByWarehouse.length
        ? row.stockByWarehouse.map((item) => `${item.warehouseName}: ${formatNumber(item.quantity)}`).join(" | ")
        : "";
    case "supplierNames":
      return row.supplierNames.join(" | ");
    default:
      return rawValue === null || rawValue === undefined ? "" : String(rawValue);
  }
}

function toCsvScalar(value: unknown, options?: CsvExportOptions): string {
  const decimalSeparator = options?.decimalSeparator ?? ",";
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return formatDecimal(value, decimalSeparator);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function escapeCsvValue(value: string, delimiter: string): string {
  const escapedDelimiter = delimiter === "\t" ? "\t" : delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`[\n\r${escapedDelimiter}\"]`).test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildInventoryCsv(rows: InventoryExportRow[], fields: InventoryExportFieldDefinition[], options?: CsvExportOptions): Blob {
  const delimiter = options?.delimiter ?? ";";
  const header = fields.map((field) => field.label);
  const data = rows.map((row) => fields.map((field) => toCsvScalar(getInventoryFieldRawValue(row, field.key), options)));
  const lines = [header, ...data].map((line) => line.map((cell) => escapeCsvValue(String(cell ?? ""), delimiter)).join(delimiter));
  if (delimiter === ";") lines.unshift("sep=;");
  const prefix = options?.includeBom === false ? "" : "\uFEFF";
  return new Blob([`${prefix}${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
}

export function buildInventoryJson(rows: InventoryExportRow[], fields: InventoryExportFieldDefinition[], metadata?: Record<string, unknown>): Blob {
  const payload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalRows: rows.length,
      fields: fields.map((field) => ({ key: field.key, label: field.label })),
      ...(metadata ?? {}),
    },
    rows: rows.map((row) => Object.fromEntries(fields.map((field) => [field.key, getInventoryFieldRawValue(row, field.key)]))),
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
}

export async function buildInventoryWorkbook(rows: InventoryExportRow[], fields: InventoryExportFieldDefinition[]) {
  const XLSX = await import("xlsx");
  const header = fields.map((field) => field.label);
  const data = rows.map((row) => fields.map((field) => getInventoryFieldRawValue(row, field.key)));
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: Math.max(fields.length - 1, 0), r: rows.length } }),
  };
  worksheet["!cols"] = fields.map((field) => ({ wch: Math.max(field.label.length + 4, 18) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function buildInventoryXml(
  rows: InventoryExportRow[],
  fields: InventoryExportFieldDefinition[],
  metadata: { scopeLabel: string; filterLabel?: string | null }
): Blob {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const productsXml = rows
    .map((row) => {
      const identityFields = fields.filter((field) => ["id", "code", "name", "productGroupName", "measurementUnit"].includes(field.key));
      const financeFields = fields.filter((field) => ["price", "cost", "marginPct", "lastPurchasePrice"].includes(field.key));
      const metaFields = fields.filter((field) => ["isEnabled", "createdAt", "updatedAt", "stockTotal", "supplierNames", "lastSupplierName", "lastDocumentNumber", "lastDocumentDate"].includes(field.key));
      const stockField = fieldByKey.get("stockByWarehouse");

      const identityXml = identityFields
        .map((field) => `      <${field.xmlTag}>${xmlEscape(getInventoryFieldValue(row, field.key, "raw"))}</${field.xmlTag}>`)
        .join("\n");
      const financeXml = financeFields.length
        ? [
            "      <Finanzas>",
            ...financeFields.map(
              (field) => `        <${field.xmlTag}>${xmlEscape(getInventoryFieldValue(row, field.key, "raw"))}</${field.xmlTag}>`
            ),
            "      </Finanzas>",
          ].join("\n")
        : "";
      const metaXml = metaFields
        .map((field) => `      <${field.xmlTag}>${xmlEscape(getInventoryFieldValue(row, field.key, "raw"))}</${field.xmlTag}>`)
        .join("\n");
      const stockXml = stockField
        ? [
            "      <Existencias>",
            ...row.stockByWarehouse.map(
              (item) => `        <Almacen id="${item.warehouseId}" nombre="${xmlEscape(item.warehouseName)}">${xmlEscape(String(item.quantity))}</Almacen>`
            ),
            "      </Existencias>",
          ].join("\n")
        : "";

      return ["    <Producto>", identityXml, financeXml, metaXml, stockXml, "    </Producto>"].filter(Boolean).join("\n");
    })
    .join("\n");

  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<InventarioExportacion fecha="${new Date().toISOString()}">`,
    "  <Metadatos>",
    `    <TotalProductos>${rows.length}</TotalProductos>`,
    `    <Scope>${xmlEscape(metadata.scopeLabel)}</Scope>`,
    `    <Filtro>${xmlEscape(metadata.filterLabel ?? "")}</Filtro>`,
    "  </Metadatos>",
    "  <Productos>",
    productsXml,
    "  </Productos>",
    "</InventarioExportacion>",
  ].join("\n");
  return new Blob([content], { type: "application/xml;charset=utf-8" });
}

function normalizeRecordValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

export function buildRecordsCsv(records: Record<string, unknown>[], options?: CsvExportOptions): Blob {
  const delimiter = options?.delimiter ?? ";";
  const columns = Array.from(new Set(records.flatMap((record) => Object.keys(record ?? {}))));
  const lines = [
    columns,
    ...records.map((record) => columns.map((column) => toCsvScalar(normalizeRecordValue(record[column]), options))),
  ].map((line) => line.map((cell) => escapeCsvValue(String(cell ?? ""), delimiter)).join(delimiter));
  if (delimiter === ";") lines.unshift("sep=;");
  const prefix = options?.includeBom === false ? "" : "\uFEFF";
  return new Blob([`${prefix}${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
}

export function buildRecordsXml(tableName: string, records: Record<string, unknown>[]): Blob {
  const items = records
    .map((record) => {
      const fields = Object.entries(record).map(
        ([key, value]) => `    <${key}>${xmlEscape(typeof value === "object" ? JSON.stringify(value) : String(value ?? ""))}</${key}>`
      );
      return ["  <Row>", ...fields, "  </Row>"].join("\n");
    })
    .join("\n");
  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<TableExport name="${xmlEscape(tableName)}" generatedAt="${new Date().toISOString()}">`,
    items,
    "</TableExport>",
  ].join("\n");
  return new Blob([content], { type: "application/xml;charset=utf-8" });
}

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 9,
    marginBottom: 12,
    color: "#4b5563",
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "solid",
  },
  row: {
    flexDirection: "row",
  },
  headerRow: {
    backgroundColor: "#f3f4f6",
  },
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    borderRightStyle: "solid",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    borderBottomStyle: "solid",
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  headerText: {
    fontWeight: 700,
  },
});

function InventoryExportPdf({ rows, fields, title, subtitle }: { rows: InventoryExportRow[]; fields: InventoryExportFieldDefinition[]; title: string; subtitle: string }) {
  return (
    <Document>
      <Page size="A4" orientation={fields.length > 6 ? "landscape" : "portrait"} style={pdfStyles.page}>
        <Text style={pdfStyles.title}>{title}</Text>
        <Text style={pdfStyles.subtitle}>{subtitle}</Text>
        <View style={pdfStyles.table}>
          <View style={[pdfStyles.row, pdfStyles.headerRow]}>
            {fields.map((field, index) => (
              <View key={field.key} style={index === fields.length - 1 ? [pdfStyles.cell, pdfStyles.lastCell] : pdfStyles.cell}>
                <Text style={pdfStyles.headerText}>{field.label}</Text>
              </View>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row.id} style={pdfStyles.row}>
              {fields.map((field, index) => (
                <View key={`${row.id}-${field.key}`} style={index === fields.length - 1 ? [pdfStyles.cell, pdfStyles.lastCell] : pdfStyles.cell}>
                  <Text>{getInventoryFieldValue(row, field.key, "display")}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function buildInventoryPdf(rows: InventoryExportRow[], fields: InventoryExportFieldDefinition[], title: string, subtitle: string): Promise<Blob> {
  const instance = pdf(<InventoryExportPdf rows={rows} fields={fields} title={title} subtitle={subtitle} />);
  return await instance.toBlob();
}