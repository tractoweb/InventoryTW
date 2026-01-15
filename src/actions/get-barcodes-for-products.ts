"use server";

import { unstable_noStore as noStore } from "next/cache";
import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
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
  noStore();

  try {
    const ids = Array.from(
      new Set((productIds ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
    );

    if (ids.length === 0) return { data: {} };

    const lists = await mapWithConcurrency(ids, 10, async (idProduct) => {
      const listRes = await listAllPages<any>((listArgs) => amplifyClient.models.Barcode.list(listArgs), {
        filter: { productId: { eq: Number(idProduct) } },
      });

      if ("error" in listRes) return { idProduct, barcodes: [] as string[] };

      const barcodes = (listRes.data ?? [])
        .map((b: any) => String(b?.value ?? "").trim())
        .filter((v: string) => v.length > 0);

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
