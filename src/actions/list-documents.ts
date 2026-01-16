"use server";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";
import { documentTypeLabelEs } from "@/lib/document-type-label";
import { cached } from "@/lib/server-cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type DocumentListFilters = {
  q?: string;
  customerId?: number;
  warehouseId?: number;
  documentTypeId?: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  /** Force stable scan+sort pagination (recommended for correct ordering). */
  useScan?: boolean;
  nextToken?: string | null;
  page?: number; // only used in scan-mode (q search)
  pageSize?: number;
  limit?: number; // backwards compat alias for pageSize
};

export type DocumentListRow = {
  documentId: number;
  number: string;
  date: string;
  stockDate: string;
  total: number;
  paidStatus: number;
  isClockedOut: boolean;
  customerId?: number | null;
  userId: number;
  warehouseId: number;
  documentTypeId: number;
  customerName?: string | null;
  userName?: string | null;
  warehouseName?: string | null;
  documentTypeName?: string | null;
};

type Customer = { idCustomer: number; name: string };
type User = { userId: number; username: string };
type Warehouse = { idWarehouse: number; name: string };
type DocumentType = { documentTypeId: number; name: string; printTemplate?: string | null; languageKey?: string | null };

export async function listDocuments(filters?: DocumentListFilters) {
  try {
    const filter: any = {};

    if (filters?.customerId !== undefined) {
      filter.customerId = { eq: Number(filters.customerId) };
    }
    if (filters?.warehouseId !== undefined) {
      filter.warehouseId = { eq: Number(filters.warehouseId) };
    }
    if (filters?.documentTypeId !== undefined) {
      filter.documentTypeId = { eq: Number(filters.documentTypeId) };
    }

    if (filters?.dateFrom || filters?.dateTo) {
      filter.date = {};
      if (filters.dateFrom) filter.date.ge = filters.dateFrom;
      if (filters.dateTo) filter.date.le = filters.dateTo;
    }

    const pageSizeRaw = filters?.pageSize ?? filters?.limit ?? 10;
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.trunc(Number(pageSizeRaw))) : 10;

    const qRaw = String(filters?.q ?? "").trim();
    const scanMode = Boolean(filters?.useScan) || qRaw.length > 0;

    let docs: any[] = [];
    let nextToken: string | null | undefined = undefined;

    if (scanMode) {
      // Stable path: scan all matching docs, apply q filter (optional), sort by stockDate, then slice by page.
      const filterKey = JSON.stringify({
        customerId: filters?.customerId ?? null,
        warehouseId: filters?.warehouseId ?? null,
        documentTypeId: filters?.documentTypeId ?? null,
        dateFrom: filters?.dateFrom ?? null,
        dateTo: filters?.dateTo ?? null,
      });

      const loadAllForScan = cached(
        async () =>
          listAllPages<any>(
            (args) => amplifyClient.models.Document.list(args),
            Object.keys(filter).length ? { filter } : undefined
          ),
        {
          keyParts: ["heavy", "documents-scan", filterKey],
          revalidateSeconds: 30,
          tags: [CACHE_TAGS.heavy.documents],
        }
      );

      const docsResult = await loadAllForScan();

      if ("error" in docsResult) return { data: [], error: docsResult.error };

      docs = (docsResult.data ?? []) as any[];
      if (qRaw.length > 0) {
        const q = qRaw.toLowerCase();
        docs = docs.filter((d) => {
          const number = String(d?.number ?? "").toLowerCase();
          const ref = String(d?.referenceDocumentNumber ?? "").toLowerCase();
          const order = String(d?.orderNumber ?? "").toLowerCase();
          return number.includes(q) || ref.includes(q) || order.includes(q);
        });
      }

      docs.sort((a, b) => String(b?.stockDate ?? "").localeCompare(String(a?.stockDate ?? "")));

      const pageRaw = filters?.page ?? 1;
      const page = Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(Number(pageRaw))) : 1;
      const startIdx = (page - 1) * pageSize;
      docs = docs.slice(startIdx, startIdx + pageSize);
      nextToken = null;
    } else {
      const res: any = await amplifyClient.models.Document.list({
        ...(Object.keys(filter).length ? { filter } : {}),
        limit: pageSize,
        nextToken: filters?.nextToken ?? undefined,
      });

      docs = (res?.data ?? []) as any[];
      nextToken = res?.nextToken ?? null;
    }

    const uniqueCustomerIds = Array.from(
      new Set(
        docs
          .map((d) => (d?.customerId !== undefined && d?.customerId !== null ? Number(d.customerId) : null))
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0)
      )
    );

    const uniqueUserIds = Array.from(
      new Set(
        docs
          .map((d) => Number(d?.userId))
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0)
      )
    );

    const uniqueWarehouseIds = Array.from(
      new Set(
        docs
          .map((d) => Number(d?.warehouseId))
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0)
      )
    );

    const uniqueDocumentTypeIds = Array.from(
      new Set(
        docs
          .map((d) => Number(d?.documentTypeId))
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0)
      )
    );

    const [customers, users, warehouses, documentTypes] = await Promise.all([
      Promise.all(uniqueCustomerIds.map((idCustomer) => amplifyClient.models.Customer.get({ idCustomer }))),
      Promise.all(uniqueUserIds.map((userId) => amplifyClient.models.User.get({ userId }))),
      Promise.all(uniqueWarehouseIds.map((idWarehouse) => amplifyClient.models.Warehouse.get({ idWarehouse }))),
      Promise.all(uniqueDocumentTypeIds.map((documentTypeId) => amplifyClient.models.DocumentType.get({ documentTypeId }))),
    ]);

    const customerById = new Map<number, string>(
      customers
        .map((r: any) => r?.data)
        .filter(Boolean)
        .map((c: any) => [Number(c?.idCustomer), String(c?.name ?? "")])
    );
    const userById = new Map<number, string>(
      users
        .map((r: any) => r?.data)
        .filter(Boolean)
        .map((u: any) => [Number(u?.userId), String(u?.username ?? "")])
    );
    const warehouseById = new Map<number, string>(
      warehouses
        .map((r: any) => r?.data)
        .filter(Boolean)
        .map((w: any) => [Number(w?.idWarehouse), String(w?.name ?? "")])
    );
    const documentTypeById = new Map<number, string>(
      documentTypes
        .map((r: any) => r?.data)
        .filter(Boolean)
        .map((dt: any) => [
          Number(dt?.documentTypeId),
          documentTypeLabelEs({
            name: dt?.name ?? null,
            printTemplate: dt?.printTemplate ?? null,
            code: dt?.code ?? null,
            languageKey: dt?.languageKey ?? null,
          }),
        ])
    );

    const rows: DocumentListRow[] = docs.map((d) => {
      const customerId = d?.customerId !== undefined && d?.customerId !== null ? Number(d.customerId) : null;
      return {
        documentId: Number(d.documentId),
        number: String(d.number ?? ""),
        date: String(d.date ?? ""),
        stockDate: String(d.stockDate ?? ""),
        total: Number(d.total ?? 0),
        paidStatus: Number(d.paidStatus ?? 0),
        isClockedOut: Boolean(d.isClockedOut ?? false),
        customerId,
        userId: Number(d.userId),
        warehouseId: Number(d.warehouseId),
        documentTypeId: Number(d.documentTypeId),
        customerName: customerId ? customerById.get(customerId) ?? null : null,
        userName: userById.get(Number(d.userId)) ?? null,
        warehouseName: warehouseById.get(Number(d.warehouseId)) ?? null,
        documentTypeName: documentTypeById.get(Number(d.documentTypeId)) ?? null,
      };
    });

    return {
      data: rows,
      nextToken: nextToken ?? null,
      scanMode,
    };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
