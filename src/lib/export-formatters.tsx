"use client";

import * as React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import type {
  InventoryExportFieldDefinition,
  InventoryExportFieldKey,
  InventoryExportRow,
} from "@/types/export.types";

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
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNumber(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function getInventoryFieldValue(row: InventoryExportRow, key: InventoryExportFieldKey, mode: "display" | "raw" = "display"): string {
  switch (key) {
    case "id":
      return String(row.id);
    case "name":
      return row.name;
    case "code":
      return row.code ?? "";
    case "productGroupName":
      return row.productGroupName ?? "";
    case "measurementUnit":
      return row.measurementUnit ?? "";
    case "cost":
      return mode === "display" ? formatMoney(row.cost) : String(row.cost ?? "");
    case "price":
      return mode === "display" ? formatMoney(row.price) : String(row.price ?? "");
    case "lastPurchasePrice":
      return mode === "display" ? formatMoney(row.lastPurchasePrice) : String(row.lastPurchasePrice ?? "");
    case "marginPct":
      return row.marginPct === null ? "" : mode === "display" ? `${formatNumber(row.marginPct)}%` : String(row.marginPct);
    case "isEnabled":
      return row.isEnabled ? "Sí" : "No";
    case "createdAt":
      return formatDate(row.createdAt);
    case "updatedAt":
      return formatDate(row.updatedAt);
    case "supplierNames":
      return row.supplierNames.join(" | ");
    case "lastSupplierName":
      return row.lastSupplierName ?? "";
    case "lastDocumentNumber":
      return row.lastDocumentNumber ?? "";
    case "lastDocumentDate":
      return formatDate(row.lastDocumentDate);
    case "stockTotal":
      return mode === "display" ? formatNumber(row.stockTotal) : String(row.stockTotal ?? 0);
    case "stockByWarehouse":
      return row.stockByWarehouse.length
        ? row.stockByWarehouse.map((item) => `${item.warehouseName}: ${formatNumber(item.quantity)}`).join(" | ")
        : "";
    default:
      return "";
  }
}

export function buildInventoryCsv(rows: InventoryExportRow[], fields: InventoryExportFieldDefinition[]): Blob {
  const esc = (value: string) => {
    if (/[\n\r\t,\"]/g.test(value)) return `"${value.replace(/\"/g, '""')}"`;
    return value;
  };

  const header = fields.map((field) => field.label);
  const data = rows.map((row) => fields.map((field) => getInventoryFieldValue(row, field.key, "raw")));
  const content = [header, ...data].map((line) => line.map((cell) => esc(String(cell ?? ""))).join(",")).join("\n");
  return new Blob([content], { type: "text/csv;charset=utf-8" });
}

export function buildInventoryXml(rows: InventoryExportRow[], fields: InventoryExportFieldDefinition[], metadata: {
  scopeLabel: string;
  filterLabel?: string | null;
}): Blob {
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
              (item) =>
                `        <Almacen id="${item.warehouseId}" nombre="${xmlEscape(item.warehouseName)}">${xmlEscape(String(item.quantity))}</Almacen>`
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

function InventoryExportPdf({ rows, fields, title, subtitle }: {
  rows: InventoryExportRow[];
  fields: InventoryExportFieldDefinition[];
  title: string;
  subtitle: string;
}) {
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
                <View
                  key={`${row.id}-${field.key}`}
                  style={index === fields.length - 1 ? [pdfStyles.cell, pdfStyles.lastCell] : pdfStyles.cell}
                >
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