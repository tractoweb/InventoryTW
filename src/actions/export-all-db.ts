"use server";

import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

const TABLE_MODELS = [
  "User",
  "Company",
  "Country",
  "Currency",
  "Warehouse",
  "ProductGroup",
  "Product",
  "Barcode",
  "Stock",
  "StockControl",
  "ProductComment",
  "Kardex",
  "KardexHistory",
  "Customer",
  "Client",
  "CustomerDiscount",
  "LoyaltyCard",
  "DocumentCategory",
  "DocumentType",
  "Document",
  "DocumentItem",
  "DocumentItemPriceView",
  "Tax",
  "ProductTax",
  "DocumentItemTax",
  "PaymentType",
  "Payment",
  "PosOrder",
  "PosOrderItem",
  "StartingCash",
  "Counter",
  "ApplicationProperty",
  "ZReport",
  "Template",
  "SessionConfig",
  "ApplicationSettings",
  "AuditLog",
  "DocumentNumber",
  "PrintLabelRequest",
  "PrintLabelRequestItem",
] as const;

export async function exportAllDbAction(): Promise<{
  data?: Record<string, unknown[]>;
  meta?: {
    generatedAt: string;
    tableCount: number;
    rowCounts: Record<string, number>;
  };
  error?: string;
}> {
  noStore();

  try {
    const entries = await Promise.all(
      TABLE_MODELS.map(async (tableName) => {
        const model = (amplifyClient.models as any)?.[tableName];
        if (!model?.list) return [tableName, []] as const;

        const result = await listAllPages<any>((args) => model.list(args));
        if ("error" in result) {
          throw new Error(`No se pudo exportar ${tableName}: ${result.error}`);
        }

        const rows = (result.data ?? []).map((row: any) => JSON.parse(JSON.stringify(row)));
        return [tableName, rows] as const;
      })
    );

    const data = Object.fromEntries(entries) as Record<string, unknown[]>;
    const rowCounts = Object.fromEntries(
      Object.entries(data).map(([tableName, rows]) => [tableName, Array.isArray(rows) ? rows.length : 0])
    );

    return {
      data,
      meta: {
        generatedAt: new Date().toISOString(),
        tableCount: TABLE_MODELS.length,
        rowCounts,
      },
    };
  } catch (error) {
    return { error: formatAmplifyError(error) };
  }
}