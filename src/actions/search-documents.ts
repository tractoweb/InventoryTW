"use server";
import { formatAmplifyError } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';
import { unstable_noStore as noStore } from 'next/cache';
import { listAllPages } from "@/services/amplify-list-all";
import { cached } from "@/lib/server-cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type DocumentSearchResult = {
    id: number;
    number: string;
    customername: string | null;
};

function safeJsonParse(value: unknown): any | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function searchDocuments(searchTerm: string) {
  // Search should always be live
  noStore();
  
  if (!searchTerm) {
    return { data: [] };
  }

  try {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return { data: [] };

    const docsResult = await listAllPages<any>((args) => amplifyClient.models.Document.list(args));
    if ("error" in docsResult) return { error: docsResult.error };

    const docs = (docsResult.data ?? [])
      .filter((d: any) => {
        const number = String(d?.number ?? "").toLowerCase();
        const ref = String(d?.referenceDocumentNumber ?? "").toLowerCase();
        const order = String(d?.orderNumber ?? "").toLowerCase();
        return number.includes(term) || ref.includes(term) || order.includes(term);
      })
      .slice(0, 50);

    // Join customer names (best-effort)
    const customersResult = await cached(
      async () => listAllPages<any>((args) => amplifyClient.models.Customer.list(args)),
      {
        keyParts: ["partners", "customers", "all"],
        revalidateSeconds: 60,
        tags: [CACHE_TAGS.heavy.customers],
      }
    )();
    const customerById = new Map<number, string>();
    if (!("error" in customersResult)) {
      for (const c of customersResult.data ?? []) {
        customerById.set(Number((c as any).idCustomer), String((c as any).name ?? ""));
      }
    }

    const data: DocumentSearchResult[] = docs.map((d: any) => {
      const customerId = d?.customerId !== undefined && d?.customerId !== null ? Number(d.customerId) : null;

      const clientNameSnapshot = d?.clientNameSnapshot !== undefined && d?.clientNameSnapshot !== null ? String(d.clientNameSnapshot).trim() : '';
      let clientName: string | null = clientNameSnapshot.length > 0 ? clientNameSnapshot : null;
      if (!clientName) {
        const parsed = safeJsonParse(d?.internalNote);
        const name = parsed?.customer?.name;
        if (typeof name === 'string' && name.trim().length > 0) clientName = name.trim();
      }

      return {
        id: Number(d.documentId),
        number: String(d.number ?? ""),
        customername: clientName ?? (customerId ? customerById.get(customerId) ?? null : null),
      };
    });

    return { data };
  } catch (error: any) {
    return { error: formatAmplifyError(error) || 'Error searching documents.' };
  }
}
