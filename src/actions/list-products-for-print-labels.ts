"use server";

import { unstable_cache } from "next/cache";
import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { CACHE_TAGS } from "@/lib/cache-tags";
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

function hashKey(value: string): string {
  // Small stable hash to keep cache keys short (non-crypto).
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = (h * 33) ^ value.charCodeAt(i);
  return (h >>> 0).toString(16);
}

type ProductLite = {
  idProduct: number;
  name: string;
  code: string | null;
  measurementUnit: string | null;
  createdAt: string | null;
};

function toProductLite(p: any): ProductLite {
  return {
    idProduct: Number(p?.idProduct ?? 0),
    name: String(p?.name ?? ""),
    code: p?.code ? String(p.code) : null,
    measurementUnit: p?.measurementUnit ? String(p.measurementUnit) : null,
    createdAt: p?.createdAt ? String(p.createdAt) : null,
  };
}

async function listAllProductsCached(): Promise<ProductLite[]> {
  const keyParts = ["print-labels", "products", "all"];

  const fn = unstable_cache(
    async () => {
      const res = await listAllPages<any>((listArgs) => amplifyClient.models.Product.list(listArgs), {});
      if ("error" in res) throw new Error(res.error);

      const items = ((res.data ?? []) as any[])
        .map(toProductLite)
        .filter((p) => Number.isFinite(p.idProduct) && p.idProduct > 0);

      const toMs = (v: unknown) => {
        const ms = Date.parse(String(v ?? ""));
        return Number.isFinite(ms) ? ms : 0;
      };

      items.sort((a, b) => {
        const ams = toMs(a.createdAt);
        const bms = toMs(b.createdAt);
        if (ams !== bms) return bms - ams;
        return b.idProduct - a.idProduct;
      });

      return items;
    },
    keyParts,
    {
      revalidate: 60,
      tags: [CACHE_TAGS.heavy.productsMaster],
    }
  );

  return fn();
}

async function searchProductsCached(qRaw: string): Promise<ProductLite[]> {
  const q = String(qRaw ?? "").trim();
  const qLoose = normalizeLoose(q);
  const keyParts = ["print-labels", "products", "search", hashKey(qLoose)];

  const fn = unstable_cache(
    async () => {
      // Keep search lightweight: only Products table (name/code/id). Barcodes are loaded separately.
      const [byNameRes, byCodeRes] = await Promise.all([
        listAllPages<any>((listArgs) => amplifyClient.models.Product.list(listArgs), {
          filter: { name: { contains: q } },
        }),
        listAllPages<any>((listArgs) => amplifyClient.models.Product.list(listArgs), {
          filter: { code: { contains: q } },
        }),
      ]);

      if ("error" in byNameRes) throw new Error(byNameRes.error);
      if ("error" in byCodeRes) throw new Error(byCodeRes.error);

      const byId = new Map<number, ProductLite>();
      for (const p of (byNameRes.data ?? []) as any[]) {
        const lite = toProductLite(p);
        if (Number.isFinite(lite.idProduct) && lite.idProduct > 0) byId.set(lite.idProduct, lite);
      }
      for (const p of (byCodeRes.data ?? []) as any[]) {
        const lite = toProductLite(p);
        if (Number.isFinite(lite.idProduct) && lite.idProduct > 0) byId.set(lite.idProduct, lite);
      }

      const merged = Array.from(byId.values()).filter((p) => {
        const idText = String(p.idProduct);
        const name = normalizeLoose(p.name);
        const code = normalizeLoose(p.code ?? "");
        return idText.includes(qLoose) || name.includes(qLoose) || code.includes(qLoose);
      });

      const toMs = (v: unknown) => {
        const ms = Date.parse(String(v ?? ""));
        return Number.isFinite(ms) ? ms : 0;
      };

      merged.sort((a, b) => {
        const ams = toMs(a.createdAt);
        const bms = toMs(b.createdAt);
        if (ams !== bms) return bms - ams;
        return b.idProduct - a.idProduct;
      });
      return merged;
    },
    keyParts,
    {
      revalidate: 60,
      tags: [CACHE_TAGS.heavy.productsMaster],
    }
  );

  return fn();
}

export async function listProductsForPrintLabels(args?: ListProductsForPrintLabelsArgs): Promise<{
  data: PrintLabelsProductRow[];
  nextToken: string | null;
  error?: string;
}> {
  try {
    const pageSizeRaw = args?.pageSize ?? args?.limit ?? 50;
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.trunc(Number(pageSizeRaw))) : 50;

    const qRaw = String(args?.q ?? "").trim();
    const searchMode = qRaw.length > 0;

    let products: ProductLite[] = [];
    let nextToken: string | null = null;

    if (!searchMode) {
      const offsetRaw = args?.nextToken ?? "0";
      const offsetParsed = Number.parseInt(String(offsetRaw), 10);
      const offset = Number.isFinite(offsetParsed) && offsetParsed >= 0 ? offsetParsed : 0;

      const all = await listAllProductsCached();
      products = all.slice(offset, offset + pageSize);
      const nextOffset = offset + pageSize;
      nextToken = nextOffset < all.length ? String(nextOffset) : null;
    } else {
      // Search mode: cache the merged candidate set (Products table only), then paginate locally.
      const offsetRaw = args?.nextToken ?? "0";
      const offsetParsed = Number.parseInt(String(offsetRaw), 10);
      const offset = Number.isFinite(offsetParsed) && offsetParsed >= 0 ? offsetParsed : 0;

      const merged = await searchProductsCached(qRaw);
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
