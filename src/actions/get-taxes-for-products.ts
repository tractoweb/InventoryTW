"use server";

import { unstable_noStore as noStore } from "next/cache";

import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function getTaxesForProducts(productIds: number[]): Promise<{
  data: Record<number, string[]>;
  error?: string;
}> {
  noStore();

  try {
    const ids = Array.from(
      new Set((productIds ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
    );

    if (ids.length === 0) return { data: {} };

    // For the current visible set, list ProductTax per product, then batch-fetch unique Tax records.
    const productTaxLists = await mapWithConcurrency(ids, 10, async (idProduct) => {
      const listRes = await listAllPages<any>((listArgs) => amplifyClient.models.ProductTax.list(listArgs), {
        filter: { productId: { eq: Number(idProduct) } },
      });
      const items = "error" in listRes ? [] : (listRes.data ?? []);
      const taxIds = items
        .map((pt: any) => Number(pt?.taxId))
        .filter((t: any) => Number.isFinite(t) && t > 0);

      return { idProduct, taxIds };
    });

    const uniqueTaxIds = Array.from(new Set(productTaxLists.flatMap((x) => x.taxIds))).sort((a, b) => a - b);
    const taxGets = await Promise.all(uniqueTaxIds.map((idTax) => amplifyClient.models.Tax.get({ idTax } as any)));

    const taxNameById = new Map<number, string>();
    for (let i = 0; i < uniqueTaxIds.length; i++) {
      const t = (taxGets[i] as any)?.data;
      if (!t) continue;
      taxNameById.set(uniqueTaxIds[i], String((t as any)?.name ?? `#${uniqueTaxIds[i]}`));
    }

    const map: Record<number, string[]> = {};
    for (const item of productTaxLists) {
      map[item.idProduct] = item.taxIds.map((id: number) => taxNameById.get(id) ?? `#${id}`);
    }

    return { data: map };
  } catch (error) {
    return { data: {}, error: formatAmplifyError(error) };
  }
}
