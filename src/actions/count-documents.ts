"use server";

import { unstable_noStore as noStore } from "next/cache";

import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export type CountDocumentsFilters = {
  q?: string;
  customerId?: number;
  warehouseId?: number;
  documentTypeId?: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
};

export async function countDocuments(filters?: CountDocumentsFilters): Promise<{ total: number; error?: string }> {
  noStore();

  try {
    const filter: any = {};

    if (filters?.customerId !== undefined) filter.customerId = { eq: Number(filters.customerId) };
    if (filters?.warehouseId !== undefined) filter.warehouseId = { eq: Number(filters.warehouseId) };
    if (filters?.documentTypeId !== undefined) filter.documentTypeId = { eq: Number(filters.documentTypeId) };

    if (filters?.dateFrom || filters?.dateTo) {
      filter.date = {};
      if (filters.dateFrom) filter.date.ge = filters.dateFrom;
      if (filters.dateTo) filter.date.le = filters.dateTo;
    }

    const docsResult = await listAllPages<any>(
      (args) => amplifyClient.models.Document.list(args),
      Object.keys(filter).length ? { filter } : undefined
    );

    if ("error" in docsResult) return { total: 0, error: docsResult.error };

    let docs = (docsResult.data ?? []) as any[];

    const q = String(filters?.q ?? "").trim().toLowerCase();
    if (q) {
      docs = docs.filter((d) => {
        const number = String(d?.number ?? "").toLowerCase();
        const ref = String(d?.referenceDocumentNumber ?? "").toLowerCase();
        const order = String(d?.orderNumber ?? "").toLowerCase();
        return number.includes(q) || ref.includes(q) || order.includes(q);
      });
    }

    return { total: docs.length };
  } catch (error) {
    return { total: 0, error: formatAmplifyError(error) };
  }
}
