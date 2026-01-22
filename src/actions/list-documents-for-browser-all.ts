"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";
import { documentTypeLabelEs } from "@/lib/document-type-label";
import { cached } from "@/lib/server-cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type DocumentsCatalogRow = {
  documentId: number;
  number: string;
  date: string;
  stockDate: string;
  total: number;
  paidStatus: number;
  isClockedOut: boolean;
  customerId?: number | null;
  clientId?: number | null;
  clientNameSnapshot?: string | null;
  userId: number;
  warehouseId: number;
  documentTypeId: number;
  documentCategoryId?: number | null;
  referenceDocumentNumber?: string | null;
  orderNumber?: string | null;
  customerName?: string | null;
  thirdPartyName?: string | null;
  userName?: string | null;
  warehouseName?: string | null;
  documentTypeName?: string | null;
};

type Customer = { idCustomer: number; name: string };
type User = { userId: number; username: string };
type Warehouse = { idWarehouse: number; name: string };
type DocumentType = {
  documentTypeId: number;
  name: string;
  code?: string | null;
  printTemplate?: string | null;
  languageKey?: string | null;
  documentCategoryId?: number | null;
};

function safeJsonParse(value: unknown): any | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function listDocumentsForBrowserAll(): Promise<{ data: DocumentsCatalogRow[]; error?: string }> {
  noStore();

  try {
    const cachedCustomers = cached(
      async () => listAllPages<Customer>((args) => amplifyClient.models.Customer.list(args)),
      { keyParts: ["partners", "customers", "all"], revalidateSeconds: 60, tags: [CACHE_TAGS.heavy.customers] }
    );

    const [docsResult, customersResult, usersResult, warehousesResult, documentTypesResult] = await Promise.all([
      listAllPages<any>((args) => amplifyClient.models.Document.list(args)),
      cachedCustomers(),
      listAllPages<User>((args) => amplifyClient.models.User.list(args)),
      listAllPages<Warehouse>((args) => amplifyClient.models.Warehouse.list(args)),
      listAllPages<DocumentType>((args) => amplifyClient.models.DocumentType.list(args)),
    ]);

    if ("error" in docsResult) return { data: [], error: docsResult.error };

    const customerById = new Map<number, string>();
    if (!("error" in customersResult)) {
      for (const c of customersResult.data ?? []) {
        const id = Number((c as any)?.idCustomer);
        if (Number.isFinite(id) && id > 0) customerById.set(id, String((c as any)?.name ?? ""));
      }
    }

    const userById = new Map<number, string>();
    if (!("error" in usersResult)) {
      for (const u of usersResult.data ?? []) {
        const id = Number((u as any)?.userId);
        if (Number.isFinite(id) && id > 0) userById.set(id, String((u as any)?.username ?? ""));
      }
    }

    const warehouseById = new Map<number, string>();
    if (!("error" in warehousesResult)) {
      for (const w of warehousesResult.data ?? []) {
        const id = Number((w as any)?.idWarehouse);
        if (Number.isFinite(id) && id > 0) warehouseById.set(id, String((w as any)?.name ?? ""));
      }
    }

    const documentTypeById = new Map<number, string>();
    const categoryByDocumentTypeId = new Map<number, number>();
    if (!("error" in documentTypesResult)) {
      for (const dt of documentTypesResult.data ?? []) {
        const id = Number((dt as any)?.documentTypeId);
        if (!Number.isFinite(id) || id <= 0) continue;

        const categoryId = Number((dt as any)?.documentCategoryId ?? 0) || 0;
        if (categoryId > 0) categoryByDocumentTypeId.set(id, categoryId);

        documentTypeById.set(
          id,
          documentTypeLabelEs({
            name: (dt as any)?.name ?? null,
            printTemplate: (dt as any)?.printTemplate ?? null,
            code: (dt as any)?.code ?? null,
            languageKey: (dt as any)?.languageKey ?? null,
          })
        );
      }
    }

    const rows: DocumentsCatalogRow[] = (docsResult.data ?? [])
      .map((d: any) => {
        const documentId = Number(d?.documentId ?? 0);
        const customerId = d?.customerId !== undefined && d?.customerId !== null ? Number(d.customerId) : null;
        const clientId = d?.clientId !== undefined && d?.clientId !== null ? Number(d.clientId) : null;
        const clientNameSnapshot = d?.clientNameSnapshot !== undefined && d?.clientNameSnapshot !== null ? String(d.clientNameSnapshot) : null;
        const userId = Number(d?.userId ?? 0);
        const warehouseId = Number(d?.warehouseId ?? 0);
        const documentTypeId = Number(d?.documentTypeId ?? 0);

        const categoryId = categoryByDocumentTypeId.get(documentTypeId) ?? null;

        const supplierName = customerId && Number.isFinite(customerId) ? customerById.get(customerId) ?? null : null;

        // Prefer explicit clientNameSnapshot for Sales, fallback to POS internal note.
        let derivedClientName: string | null = clientNameSnapshot && clientNameSnapshot.trim().length > 0 ? clientNameSnapshot : null;
        if (!derivedClientName) {
          const parsed = safeJsonParse(d?.internalNote);
          const name = parsed?.customer?.name;
          if (typeof name === 'string' && name.trim().length > 0) derivedClientName = name.trim();
        }

        const thirdPartyName =
          categoryId === 2
            ? derivedClientName
            : categoryId === 1
              ? supplierName
              : derivedClientName ?? supplierName;

        return {
          documentId,
          number: String(d?.number ?? ""),
          date: String(d?.date ?? ""),
          stockDate: String(d?.stockDate ?? ""),
          total: Number(d?.total ?? 0),
          paidStatus: Number(d?.paidStatus ?? 0),
          isClockedOut: Boolean(d?.isClockedOut ?? false),
          customerId: customerId && Number.isFinite(customerId) ? customerId : null,
          clientId: clientId && Number.isFinite(clientId) ? clientId : null,
          clientNameSnapshot,
          userId,
          warehouseId,
          documentTypeId,
          documentCategoryId: categoryId,
          referenceDocumentNumber: d?.referenceDocumentNumber ? String(d.referenceDocumentNumber) : null,
          orderNumber: d?.orderNumber ? String(d.orderNumber) : null,
          customerName: supplierName,
          thirdPartyName,
          userName: userById.get(userId) ?? null,
          warehouseName: warehouseById.get(warehouseId) ?? null,
          documentTypeName: documentTypeById.get(documentTypeId) ?? null,
        };
      })
      .filter((r: any) => Number.isFinite(r.documentId) && r.documentId > 0 && r.number.length > 0);

    // Stable default ordering (most recent first)
    rows.sort((a, b) => {
      const sd = String(b.stockDate ?? "").localeCompare(String(a.stockDate ?? ""));
      if (sd !== 0) return sd;
      return b.documentId - a.documentId;
    });

    return { data: rows };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
