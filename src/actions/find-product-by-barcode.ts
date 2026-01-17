"use server";

import { unstable_cache } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { CACHE_TAGS } from "@/lib/cache-tags";

function normalizeBarcode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

export async function findProductByBarcodeAction(barcodeRaw: string): Promise<{
  data?: { idProduct: number };
  error?: string;
}> {
  try {
    const barcode = normalizeBarcode(barcodeRaw);
    if (!barcode) return { error: "Código de barras vacío" };

    const keyParts = ["products", "barcode", barcode];

    const cached = unstable_cache(
      async () => {
        const res: any = await amplifyClient.models.Barcode.list({
          filter: { value: { eq: barcode } },
          limit: 5,
        } as any);

        const data = (res?.data ?? []) as any[];
        const first = data.find((b) => String(b?.value ?? "").trim() === barcode) ?? data[0] ?? null;
        const idProduct = Number(first?.productId ?? 0);

        if (!Number.isFinite(idProduct) || idProduct <= 0) return null;
        return { idProduct } as const;
      },
      keyParts,
      {
        revalidate: 5 * 60,
        tags: [CACHE_TAGS.heavy.productsMaster],
      }
    );

    const out = await cached();
    if (!out) return { error: "No se encontró producto para ese código" };

    return { data: out };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
