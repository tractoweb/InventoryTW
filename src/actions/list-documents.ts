"use server";

import { unstable_noStore as noStore } from "next/cache";
import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export type DocumentListFilters = {
  q?: string;
  customerId?: number;
  warehouseId?: number;
  documentTypeId?: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  limit?: number;
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
type DocumentType = { documentTypeId: number; name: string };

export async function listDocuments(filters?: DocumentListFilters) {
  noStore();

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

    // NOTE: q search is applied client-side after fetch, to avoid relying on complex OR filters.
    const docsResult = await listAllPages<any>(
      (args) => amplifyClient.models.Document.list(args),
      Object.keys(filter).length ? { filter } : undefined
    );

    if ("error" in docsResult) return { data: [], error: docsResult.error };

    let docs = (docsResult.data ?? []) as any[];

    if (filters?.q) {
      const q = filters.q.trim().toLowerCase();
      if (q) {
        docs = docs.filter((d) => {
          const number = String(d?.number ?? "").toLowerCase();
          const ref = String(d?.referenceDocumentNumber ?? "").toLowerCase();
          const order = String(d?.orderNumber ?? "").toLowerCase();
          return number.includes(q) || ref.includes(q) || order.includes(q);
        });
      }
    }

    docs.sort((a, b) => String(b?.stockDate ?? "").localeCompare(String(a?.stockDate ?? "")));

    const limit = filters?.limit && Number.isFinite(filters.limit) ? Math.max(1, Math.trunc(filters.limit)) : 200;
    docs = docs.slice(0, limit);

    const [customersResult, usersResult, warehousesResult, documentTypesResult] = await Promise.all([
      listAllPages<Customer>((args) => amplifyClient.models.Customer.list(args)),
      listAllPages<User>((args) => amplifyClient.models.User.list(args)),
      listAllPages<Warehouse>((args) => amplifyClient.models.Warehouse.list(args)),
      listAllPages<DocumentType>((args) => amplifyClient.models.DocumentType.list(args)),
    ]);

    const customers = ("error" in customersResult ? [] : customersResult.data) as any[];
    const users = ("error" in usersResult ? [] : usersResult.data) as any[];
    const warehouses = ("error" in warehousesResult ? [] : warehousesResult.data) as any[];
    const documentTypes = ("error" in documentTypesResult ? [] : documentTypesResult.data) as any[];

    const customerById = new Map<number, string>(customers.map((c) => [Number((c as any).idCustomer), String((c as any).name ?? "")]));
    const userById = new Map<number, string>(users.map((u) => [Number((u as any).userId), String((u as any).username ?? "")]));
    const warehouseById = new Map<number, string>(warehouses.map((w) => [Number((w as any).idWarehouse), String((w as any).name ?? "")]));
    const documentTypeById = new Map<number, string>(documentTypes.map((dt) => [Number((dt as any).documentTypeId), String((dt as any).name ?? "")]));

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

    return { data: rows };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
