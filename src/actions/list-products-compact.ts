"use server";

import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { cached } from "@/lib/server-cache";
import { requireSession } from "@/lib/session";

export type ProductCompact = {
  idProduct: number;
  name: string;
  code: string | null;
  cost: number | null;
  price: number | null;
  isEnabled: boolean;
  barcodes: string[];
};

export async function listProductsCompactAction(args?: {
  maxProducts?: number;
  maxBarcodes?: number;
}): Promise<{ data: ProductCompact[]; truncated: boolean; error?: string }> {
  noStore();

  // IMPORTANT (Next.js): do not read cookies/session inside `unstable_cache`.
  // We validate the session outside the cached function.
  try {
    await requireSession(ACCESS_LEVELS.CASHIER);
  } catch (e) {
    return { data: [], truncated: false, error: formatAmplifyError(e) };
  }

  const maxProductsRaw = args?.maxProducts ?? 8000;
  const maxBarcodesRaw = args?.maxBarcodes ?? 25000;

  const maxProducts = Number.isFinite(Number(maxProductsRaw)) ? Math.max(100, Math.trunc(Number(maxProductsRaw))) : 8000;
  const maxBarcodes = Number.isFinite(Number(maxBarcodesRaw)) ? Math.max(100, Math.trunc(Number(maxBarcodesRaw))) : 25000;

  const load = cached(
    async () => {
      try {
        // Products (bounded)
        const products: any[] = [];
        let nextToken: string | null | undefined = undefined;
        let truncatedProducts = false;

        do {
          const res: any = await amplifyClient.models.Product.list({
            limit: 500,
            nextToken: nextToken ?? undefined,
          } as any);

          const page = (res?.data ?? []) as any[];
          if (page.length) products.push(...page);

          nextToken = res?.nextToken ?? null;

          if (products.length >= maxProducts) {
            truncatedProducts = Boolean(nextToken);
            break;
          }
        } while (nextToken);

        const productRows = products.slice(0, maxProducts);

        // Barcodes (bounded)
        const barcodes: any[] = [];
        nextToken = undefined;
        let truncatedBarcodes = false;

        do {
          const res: any = await amplifyClient.models.Barcode.list({
            limit: 800,
            nextToken: nextToken ?? undefined,
          } as any);

          const page = (res?.data ?? []) as any[];
          if (page.length) barcodes.push(...page);

          nextToken = res?.nextToken ?? null;

          if (barcodes.length >= maxBarcodes) {
            truncatedBarcodes = Boolean(nextToken);
            break;
          }
        } while (nextToken);

        const barcodeRows = barcodes.slice(0, maxBarcodes);

        const barcodeByProductId = new Map<number, string[]>();
        for (const b of barcodeRows) {
          const pid = Number(b?.productId ?? 0);
          const value = String(b?.value ?? "").trim();
          if (!Number.isFinite(pid) || pid <= 0 || !value) continue;
          const arr = barcodeByProductId.get(pid) ?? [];
          arr.push(value);
          barcodeByProductId.set(pid, arr);
        }

        const data: ProductCompact[] = productRows
          .map((p: any) => {
            const idProduct = Number(p?.idProduct ?? 0);
            const name = String(p?.name ?? "");
            return {
              idProduct,
              name,
              code: p?.code ? String(p.code) : null,
              cost: p?.cost !== undefined && p?.cost !== null ? Number(p.cost) : null,
              price: p?.price !== undefined && p?.price !== null ? Number(p.price) : null,
              isEnabled: p?.isEnabled !== false,
              barcodes: barcodeByProductId.get(idProduct) ?? [],
            };
          })
          .filter((r: ProductCompact) => Number.isFinite(r.idProduct) && r.idProduct > 0 && r.name.length > 0);

        return {
          data,
          truncated: truncatedProducts || truncatedBarcodes,
        };
      } catch (e) {
        return { data: [], truncated: false, error: formatAmplifyError(e) };
      }
    },
    {
      keyParts: [
        "heavy",
        "products-compact",
        "v1",
        `mp:${maxProducts}`,
        `mb:${maxBarcodes}`,
      ],
      revalidateSeconds: 300,
      tags: [CACHE_TAGS.heavy.productsCompact],
    }
  );

  return await load();
}
