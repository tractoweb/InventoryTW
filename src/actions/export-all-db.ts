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
    failedTables?: string[];
  };
  error?: string;
}> {
  noStore();

  try {
    const data: Record<string, unknown[]> = {};
    const failedTables: string[] = [];
    const rowCounts: Record<string, number> = {};

    // Process each table sequentially with individual error handling
    for (const tableName of TABLE_MODELS) {
      try {
        const model = (amplifyClient.models as any)?.[tableName];
        
        if (!model?.list) {
          data[tableName] = [];
          rowCounts[tableName] = 0;
          continue;
        }

        const result = await listAllPages<any>((args) => model.list(args));
        
        // Check if listAllPages returned error
        if ("error" in result && result.error) {
          console.error(`Error exporting ${tableName}:`, result.error);
          failedTables.push(tableName);
          data[tableName] = [];
          rowCounts[tableName] = 0;
          continue;
        }

        const rows = Array.isArray(result.data) 
          ? (result.data as any[]).map((row: any) => {
              try {
                return JSON.parse(JSON.stringify(row));
              } catch {
                return row;
              }
            })
          : [];
        
        data[tableName] = rows;
        rowCounts[tableName] = rows.length;
      } catch (tableError) {
        console.error(`Failed to process ${tableName}:`, tableError);
        failedTables.push(tableName);
        data[tableName] = [];
        rowCounts[tableName] = 0;
      }
    }

    const meta = {
      generatedAt: new Date().toISOString(),
      tableCount: TABLE_MODELS.length,
      rowCounts,
      ...(failedTables.length > 0 && { failedTables }),
    };

    return {
      data,
      meta,
    };
  } catch (error) {
    console.error("exportAllDbAction fatal error:", error);
    return { 
      error: formatAmplifyError(error),
      data: {},
      meta: {
        generatedAt: new Date().toISOString(),
        tableCount: 0,
        rowCounts: {},
      }
    };
  }
}