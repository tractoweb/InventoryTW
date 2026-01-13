"use server";
import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { unstable_noStore as noStore } from 'next/cache';
import { listAllPages } from "@/services/amplify-list-all";

export type DocumentSearchResult = {
    id: number;
    number: string;
    customername: string | null;
};

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
    const customersResult = await listAllPages<any>((args) => amplifyClient.models.Customer.list(args));
    const customerById = new Map<number, string>();
    if (!("error" in customersResult)) {
      for (const c of customersResult.data ?? []) {
        customerById.set(Number((c as any).idCustomer), String((c as any).name ?? ""));
      }
    }

    const data: DocumentSearchResult[] = docs.map((d: any) => {
      const customerId = d?.customerId !== undefined && d?.customerId !== null ? Number(d.customerId) : null;
      return {
        id: Number(d.documentId),
        number: String(d.number ?? ""),
        customername: customerId ? customerById.get(customerId) ?? null : null,
      };
    });

    return { data };
  } catch (error: any) {
    return { error: formatAmplifyError(error) || 'Error searching documents.' };
  }
}
