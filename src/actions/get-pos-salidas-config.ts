"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";

const Schema = z.object({
  warehouseId: z.coerce.number().int().positive(),
});

export type PosSalidasConfig = {
  warehouseId: number;
  defaultDocumentTypeId: number | null;
};

function keyForWarehouse(warehouseId: number): string {
  return `posSalidas.defaultDocumentTypeId.${warehouseId}`;
}

export async function getPosSalidasConfigAction(raw: z.input<typeof Schema>): Promise<{
  data?: PosSalidasConfig;
  error?: string;
}> {
  noStore();

  try {
    await requireSession(ACCESS_LEVELS.CASHIER);
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }

  const parsed = Schema.safeParse(raw ?? {});
  if (!parsed.success) return { error: "Datos inválidos" };

  const warehouseId = Number(parsed.data.warehouseId);

  try {
    const name = keyForWarehouse(warehouseId);
    const res: any = await amplifyClient.models.ApplicationProperty.get({ name } as any).catch(() => null);

    const rawValue = res?.data?.value;
    const n = rawValue !== undefined && rawValue !== null ? Number(rawValue) : NaN;

    return {
      data: {
        warehouseId,
        defaultDocumentTypeId: Number.isFinite(n) && n > 0 ? n : null,
      },
    };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
