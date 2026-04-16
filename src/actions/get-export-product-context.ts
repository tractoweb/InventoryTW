"use server";

import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

const Schema = z.object({
  productIds: z.array(z.coerce.number().int().positive()).max(5000),
});

type ProductContextItem = {
  productId: number;
  lastPurchasePrice: number | null;
  supplierIds: number[];
  supplierNames: string[];
  lastSupplierName: string | null;
  lastDocumentNumber: string | null;
  lastDocumentDate: string | null;
};

async function mapWithConcurrency<T, U>(items: T[], concurrency: number, mapper: (item: T) => Promise<U>): Promise<U[]> {
  const results = new Array<U>(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return results;
}

export async function getExportProductContext(raw: z.input<typeof Schema>): Promise<{
  data: ProductContextItem[];
  error?: string;
}> {
  noStore();

  const parsed = Schema.safeParse(raw ?? {});
  if (!parsed.success) return { data: [], error: "Productos inválidos para contexto de exportación" };

  const productIds = Array.from(
    new Set(parsed.data.productIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))
  );
  if (productIds.length === 0) return { data: [] };

  try {
    const productIdSet = new Set(productIds);

    const [productsRes, documentItemsRes] = await Promise.all([
      listAllPages<any>((args) => amplifyClient.models.Product.list(args)),
      listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args)),
    ]);

    if ("error" in productsRes) return { data: [], error: productsRes.error };
    if ("error" in documentItemsRes) return { data: [], error: documentItemsRes.error };

    const productsById = new Map<number, any>();
    for (const product of productsRes.data ?? []) {
      const productId = Number((product as any)?.idProduct);
      if (!productIdSet.has(productId)) continue;
      productsById.set(productId, product);
    }

    const relevantItems = (documentItemsRes.data ?? [])
      .filter((item: any) => productIdSet.has(Number(item?.productId)))
      .map((item: any) => ({
        productId: Number(item?.productId),
        documentId: Number(item?.documentId ?? 0),
        documentItemId: Number(item?.documentItemId ?? 0),
      }))
      .filter((item: any) => Number.isFinite(item.productId) && item.productId > 0 && Number.isFinite(item.documentId) && item.documentId > 0);

    const documentIds = Array.from(new Set(relevantItems.map((item) => item.documentId)));
    const documentGets = await mapWithConcurrency(documentIds, 25, async (documentId) => {
      const result: any = await amplifyClient.models.Document.get({ documentId } as any);
      return result?.data ?? null;
    });

    const documentsById = new Map<number, any>();
    for (let index = 0; index < documentIds.length; index++) {
      if (documentGets[index]) documentsById.set(documentIds[index], documentGets[index]);
    }

    const customerIds = Array.from(
      new Set(
        documentGets
          .map((document: any) => Number(document?.customerId ?? 0))
          .filter((customerId) => Number.isFinite(customerId) && customerId > 0)
      )
    );
    const customerGets = await mapWithConcurrency(customerIds, 25, async (idCustomer) => {
      const result: any = await amplifyClient.models.Customer.get({ idCustomer } as any);
      return result?.data ?? null;
    });

    const customerNameById = new Map<number, string>();
    for (let index = 0; index < customerIds.length; index++) {
      const customer = customerGets[index];
      if (customer) customerNameById.set(customerIds[index], String(customer?.name ?? `Proveedor ${customerIds[index]}`));
    }

    const itemsByProductId = new Map<number, Array<{ documentId: number; documentItemId: number }>>();
    for (const item of relevantItems) {
      const list = itemsByProductId.get(item.productId) ?? [];
      list.push({ documentId: item.documentId, documentItemId: item.documentItemId });
      itemsByProductId.set(item.productId, list);
    }

    const data = productIds.map((productId) => {
      const product = productsById.get(productId);
      const refs = itemsByProductId.get(productId) ?? [];
      const detailedRefs = refs
        .map((ref) => {
          const document = documentsById.get(ref.documentId);
          const rawDate = document?.stockDate ?? document?.date ?? document?.createdAt ?? null;
          const timestamp = rawDate ? new Date(String(rawDate)).getTime() : 0;
          const customerId = Number(document?.customerId ?? 0);
          return {
            documentNumber: document?.number ? String(document.number) : null,
            documentDate: rawDate ? String(rawDate) : null,
            timestamp: Number.isFinite(timestamp) ? timestamp : 0,
            customerId: Number.isFinite(customerId) && customerId > 0 ? customerId : null,
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      const supplierIds = Array.from(
        new Set(detailedRefs.map((ref) => ref.customerId).filter((customerId): customerId is number => typeof customerId === "number" && customerId > 0))
      );
      const supplierNames = supplierIds
        .map((supplierId) => customerNameById.get(supplierId) ?? `Proveedor ${supplierId}`)
        .filter(Boolean);
      const latestRef = detailedRefs[0] ?? null;
      const latestSupplierName = latestRef?.customerId ? customerNameById.get(latestRef.customerId) ?? null : null;

      return {
        productId,
        lastPurchasePrice:
          product?.lastPurchasePrice !== undefined && product?.lastPurchasePrice !== null
            ? Number(product.lastPurchasePrice)
            : null,
        supplierIds,
        supplierNames,
        lastSupplierName: latestSupplierName,
        lastDocumentNumber: latestRef?.documentNumber ?? null,
        lastDocumentDate: latestRef?.documentDate ?? null,
      } satisfies ProductContextItem;
    });

    return { data };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}