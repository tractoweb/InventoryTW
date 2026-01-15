"use server";

import { unstable_noStore as noStore } from "next/cache";
import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export type PrintLabelsProductRow = {
  idProduct: number;
  name: string;
  reference: string | null;
  measurementUnit: string | null;
  createdAt: string | null;
  /** Null means barcodes not loaded yet (loaded asynchronously). */
  barcodes: string[] | null;
};

export type ListProductsForPrintLabelsArgs = {
  q?: string;
  pageSize?: number;
  limit?: number; // alias for pageSize (back-compat)
  nextToken?: string | null;
};

function normalizeLoose(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

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

export async function listProductsForPrintLabels(args?: ListProductsForPrintLabelsArgs): Promise<{
  data: PrintLabelsProductRow[];
  nextToken: string | null;
  error?: string;
}> {
  noStore();

  try {
    const pageSizeRaw = args?.pageSize ?? args?.limit ?? 50;
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.trunc(Number(pageSizeRaw))) : 50;

    const qRaw = String(args?.q ?? "").trim();
    const searchMode = qRaw.length > 0;

    let products: any[] = [];
    let nextToken: string | null = null;

    if (!searchMode) {
      const res: any = await amplifyClient.models.Product.list({
        limit: pageSize,
        nextToken: args?.nextToken ?? undefined,
      } as any);

      products = (res?.data ?? []) as any[];
      nextToken = res?.nextToken ?? null;
    } else {
      // Search mode: query across the full dataset (all pages), then paginate locally.
      const q = qRaw;
      const qLoose = normalizeLoose(qRaw);

      const offsetRaw = args?.nextToken ?? "0";
      const offsetParsed = Number.parseInt(String(offsetRaw), 10);
      const offset = Number.isFinite(offsetParsed) && offsetParsed >= 0 ? offsetParsed : 0;

      const [byNameRes, byCodeRes, byBarcodeRes] = await Promise.all([
        listAllPages<any>((listArgs) => amplifyClient.models.Product.list(listArgs), {
          filter: { name: { contains: q } },
        }),
        listAllPages<any>((listArgs) => amplifyClient.models.Product.list(listArgs), {
          filter: { code: { contains: q } },
        }),
        listAllPages<any>((listArgs) => amplifyClient.models.Barcode.list(listArgs), {
          filter: { value: { contains: q } },
        }),
      ]);

      if ("error" in byNameRes) throw new Error(byNameRes.error);
      if ("error" in byCodeRes) throw new Error(byCodeRes.error);
      if ("error" in byBarcodeRes) throw new Error(byBarcodeRes.error);

      const byId = new Map<number, any>();
      for (const p of (byNameRes.data ?? []) as any[]) {
        const id = Number((p as any)?.idProduct);
        if (Number.isFinite(id)) byId.set(id, p);
      }
      for (const p of (byCodeRes.data ?? []) as any[]) {
        const id = Number((p as any)?.idProduct);
        if (Number.isFinite(id)) byId.set(id, p);
      }

      const barcodeMatches = (byBarcodeRes.data ?? [])
        .map((b: any) => Number(b?.productId))
        .filter((id: any) => Number.isFinite(id) && id > 0);
      const uniqueBarcodeIds = Array.from(new Set(barcodeMatches));

      // Fetch barcode-matched products (bounded for safety)
      const maxBarcodeFetch = 1000;
      const barcodeProducts = await mapWithConcurrency(uniqueBarcodeIds.slice(0, maxBarcodeFetch), 10, async (idProduct) => {
        const res = await amplifyClient.models.Product.get({ idProduct: Number(idProduct) } as any);
        return (res as any)?.data ?? null;
      });
      for (const p of barcodeProducts.filter(Boolean)) {
        const id = Number((p as any)?.idProduct);
        if (Number.isFinite(id)) byId.set(id, p);
      }

      const merged = Array.from(byId.values())
        // extra in-memory match for accents/special chars
        .filter((p) => {
          const idText = String((p as any)?.idProduct ?? "");
          const name = normalizeLoose((p as any)?.name);
          const code = normalizeLoose((p as any)?.code);
          return idText.includes(qLoose) || name.includes(qLoose) || code.includes(qLoose);
        });

      merged.sort((a, b) => Number(a?.idProduct ?? 0) - Number(b?.idProduct ?? 0));
      products = merged.slice(offset, offset + pageSize);

      const nextOffset = offset + pageSize;
      nextToken = nextOffset < merged.length ? String(nextOffset) : null;
    }

    const rowsBase: Array<Omit<PrintLabelsProductRow, "barcodes">> = products.map((p) => ({
      idProduct: Number(p?.idProduct ?? 0),
      name: String(p?.name ?? ""),
      reference: p?.code ? String(p.code) : null,
      measurementUnit: p?.measurementUnit ? String(p.measurementUnit) : null,
      createdAt: p?.createdAt ? String(p.createdAt) : null,
    }));

    const rows: PrintLabelsProductRow[] = rowsBase.map((r) => ({
      ...r,
      barcodes: null,
    }));

    return { data: rows, nextToken };
  } catch (error) {
    return { data: [], nextToken: null, error: formatAmplifyError(error) };
  }
}
