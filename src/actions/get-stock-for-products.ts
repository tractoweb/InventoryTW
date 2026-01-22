"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";

const Schema = z.object({
  warehouseId: z.coerce.number().int().positive(),
  productIds: z.array(z.coerce.number().int().positive()).min(1).max(50),
});

export async function getStockForProductsAction(raw: z.input<typeof Schema>): Promise<{
  data: Record<number, number>;
  error?: string;
}> {
  noStore();

  try {
    await requireSession(ACCESS_LEVELS.CASHIER);
  } catch (e) {
    return { data: {}, error: formatAmplifyError(e) };
  }

  const parsed = Schema.safeParse(raw ?? {});
  if (!parsed.success) return { data: {}, error: "Datos inválidos" };

  const { warehouseId, productIds } = parsed.data;

  try {
    const uniqueIds = Array.from(new Set(productIds)).slice(0, 50);

    const results = await Promise.all(
      uniqueIds.map((productId) =>
        amplifyClient.models.Stock.get({ productId, warehouseId } as any).catch(() => null)
      )
    );

    const data: Record<number, number> = {};
    for (let i = 0; i < uniqueIds.length; i++) {
      const s: any = (results[i] as any)?.data;
      const qty = s?.quantity !== undefined && s?.quantity !== null ? Number(s.quantity) : null;
      data[uniqueIds[i]] = Number.isFinite(qty) ? (qty as number) : 0;
    }

    return { data };
  } catch (e) {
    return { data: {}, error: formatAmplifyError(e) };
  }
}
