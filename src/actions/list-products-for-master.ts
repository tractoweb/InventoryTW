"use server";

import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { cached } from "@/lib/server-cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type ProductsMasterRow = {
  id: number;
  name: string;
  code: string | null;
  productGroupId: number | null;
  measurementUnit: string | null;
  cost: number | null;
  price: number | null;
  isEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function listProductsForMaster(args?: {
  q?: string;
  groupId?: number | null;
  pageSize?: number;
  limit?: number; // alias for pageSize
  nextToken?: string | null;
}): Promise<{ data: ProductsMasterRow[]; nextToken: string | null; error?: string }> {
  const qRaw = String(args?.q ?? "").trim();
  const groupId = args?.groupId === undefined || args?.groupId === null ? null : Number(args.groupId);
  const pageSizeRaw = args?.pageSize ?? args?.limit ?? 10;
  const pageSize = Number.isFinite(Number(pageSizeRaw)) ? Math.max(1, Math.trunc(Number(pageSizeRaw))) : 10;
  const nextTokenIn = args?.nextToken ?? null;

  const load = cached(
    async () => {
      try {
      const qRawLocal = qRaw;
      const groupIdLocal = groupId;
      const pageSizeLocal = pageSize;

      const searchMode = qRawLocal.length > 0;

    function normalizeLoose(value: unknown): string {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();
    }

    type SearchTokens = {
      name?: string | null;
      code?: string | null;
      barcode?: string | null;
    };

    function decodeSearchTokens(value: string | null | undefined): SearchTokens {
      if (!value) return {};
      try {
        const parsed = JSON.parse(String(value));
        return {
          name: typeof parsed?.name === "string" ? parsed.name : null,
          code: typeof parsed?.code === "string" ? parsed.code : null,
          barcode: typeof parsed?.barcode === "string" ? parsed.barcode : null,
        };
      } catch {
        return {};
      }
    }

    function encodeSearchTokens(tokens: SearchTokens): string | null {
      const cleaned: SearchTokens = {
        name: tokens.name ?? null,
        code: tokens.code ?? null,
        barcode: tokens.barcode ?? null,
      };
      if (!cleaned.name && !cleaned.code && !cleaned.barcode) return null;
      return JSON.stringify(cleaned);
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

        const productGroupFilter = groupIdLocal && Number.isFinite(groupIdLocal)
          ? ({ productGroupId: { eq: groupIdLocal } } as any)
          : null;

    let products: any[] = [];
    let nextToken: string | null = null;

        if (!searchMode) {
      const res: any = await amplifyClient.models.Product.list({
        limit: pageSizeLocal,
        nextToken: nextTokenIn ?? undefined,
        ...(productGroupFilter ? { filter: productGroupFilter } : null),
      } as any);

      products = (res?.data ?? []) as any[];
      nextToken = res?.nextToken ?? null;
        } else {
      const q = qRawLocal;
      const qLoose = normalizeLoose(qRawLocal);
      const tokens = decodeSearchTokens(nextTokenIn);

      const byNameFilter = productGroupFilter
        ? ({ and: [productGroupFilter, { name: { contains: q } }] } as any)
        : ({ name: { contains: q } } as any);
      const byCodeFilter = productGroupFilter
        ? ({ and: [productGroupFilter, { code: { contains: q } }] } as any)
        : ({ code: { contains: q } } as any);

      const [byName, byCode, byBarcode] = await Promise.all([
        amplifyClient.models.Product.list({
          filter: byNameFilter,
          limit: pageSizeLocal,
          nextToken: tokens.name ?? undefined,
        } as any),
        amplifyClient.models.Product.list({
          filter: byCodeFilter,
          limit: pageSizeLocal,
          nextToken: tokens.code ?? undefined,
        } as any),
        amplifyClient.models.Barcode.list({
          filter: { value: { contains: q } },
          limit: pageSizeLocal,
          nextToken: tokens.barcode ?? undefined,
        } as any),
      ]);

      const byId = new Map<number, any>();
      for (const p of ((byName as any)?.data ?? []) as any[]) {
        const id = Number((p as any)?.idProduct);
        if (Number.isFinite(id)) byId.set(id, p);
      }
      for (const p of ((byCode as any)?.data ?? []) as any[]) {
        const id = Number((p as any)?.idProduct);
        if (Number.isFinite(id)) byId.set(id, p);
      }

      // Include barcode-matched products (bounded to avoid huge fan-out)
      const barcodeMatches = (((byBarcode as any)?.data ?? []) as any[])
        .map((b: any) => Number(b?.productId))
        .filter((id: any) => Number.isFinite(id) && id > 0);
      const uniqueBarcodeIds = Array.from(new Set(barcodeMatches)).slice(0, pageSizeLocal);

      const barcodeProducts = await mapWithConcurrency(uniqueBarcodeIds, 10, async (idProduct) => {
        const res = await amplifyClient.models.Product.get({ idProduct: Number(idProduct) } as any);
        return (res as any)?.data ?? null;
      });
      for (const p of barcodeProducts.filter(Boolean)) {
        if (productGroupFilter && Number((p as any)?.productGroupId) !== groupIdLocal) continue;
        const id = Number((p as any)?.idProduct);
        if (Number.isFinite(id)) byId.set(id, p);
      }

      const merged = Array.from(byId.values())
        // extra in-memory match for accents/special chars (small set)
        .filter((p) => {
          const idText = String((p as any)?.idProduct ?? "");
          const name = normalizeLoose((p as any)?.name);
          const code = normalizeLoose((p as any)?.code);
          return idText.includes(qLoose) || name.includes(qLoose) || code.includes(qLoose);
        });

      merged.sort((a, b) => Number(a?.idProduct ?? 0) - Number(b?.idProduct ?? 0));
      products = merged.slice(0, pageSizeLocal);

      const nextTokens: SearchTokens = {
        name: (byName as any)?.nextToken ?? null,
        code: (byCode as any)?.nextToken ?? null,
        barcode: (byBarcode as any)?.nextToken ?? null,
      };
      nextToken = encodeSearchTokens(nextTokens);
    }

    const rows: ProductsMasterRow[] = products
      .map((p: any) => {
        const id = Number(p?.idProduct ?? 0);
        const pgid = p?.productGroupId !== undefined && p?.productGroupId !== null ? Number(p.productGroupId) : null;
        return {
          id,
          name: String(p?.name ?? ""),
          code: p?.code ? String(p.code) : null,
          productGroupId: pgid && Number.isFinite(pgid) ? pgid : null,
          measurementUnit: p?.measurementUnit ? String(p.measurementUnit) : null,
          cost: p?.cost !== undefined && p?.cost !== null ? Number(p.cost) : null,
          price: p?.price !== undefined && p?.price !== null ? Number(p.price) : null,
          isEnabled: p?.isEnabled !== false,
          createdAt: p?.createdAt ? String(p.createdAt) : null,
          updatedAt: p?.updatedAt ? String(p.updatedAt) : null,
        };
      })
      .filter((r: any) => Number.isFinite(r.id) && r.id > 0 && r.name.length > 0)
      // Default behavior: exclude soft-deleted products
      .filter((r) => r.isEnabled);

        return { data: rows, nextToken };
      } catch (error) {
        return { data: [], nextToken: null, error: formatAmplifyError(error) };
      }
    },
    {
      keyParts: [
        "heavy",
        "products-master",
        qRaw,
        groupId === null ? "g:null" : `g:${groupId}`,
        `ps:${pageSize}`,
        nextTokenIn ?? "nt:null",
      ],
      revalidateSeconds: 20,
      tags: [CACHE_TAGS.heavy.productsMaster],
    }
  );

  return await load();
}
