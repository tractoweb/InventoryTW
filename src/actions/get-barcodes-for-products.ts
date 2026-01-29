"use server";

import { unstable_cache } from "next/cache";
import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { CACHE_TAGS } from "@/lib/cache-tags";
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

export async function getBarcodesForProducts(productIds: number[]): Promise<{
  data: Record<number, string[]>;
  error?: string;
}> {
  try {
    const ids = Array.from(
      new Set((productIds ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
    );

    if (ids.length === 0) return { data: {} };

    const lists = await mapWithConcurrency(ids, 10, async (idProduct) => {
      const keyParts = ["print-labels", "barcodes", String(idProduct)];
      const cached = unstable_cache(
        async () => {
          const listRes = await listAllPages<any>((listArgs) => amplifyClient.models.Barcode.list(listArgs), {
            filter: { productId: { eq: Number(idProduct) } },
          });

          if ("error" in listRes) return [] as string[];

          return (listRes.data ?? [])
            .map((b: any) => String(b?.value ?? "").trim())
            .filter((v: string) => v.length > 0);
        },
        keyParts,
        {
          // Barcodes rarely change; cache longer.
          revalidate: 300,
          tags: [CACHE_TAGS.heavy.productsMaster],
        }
      );

      const barcodes = await cached();
      return { idProduct, barcodes };
    });

    const map: Record<number, string[]> = {};
    for (const item of lists) {
      map[item.idProduct] = item.barcodes;
    }

    return { data: map };
  } catch (error) {
    return { data: {}, error: formatAmplifyError(error) };
  }
}
