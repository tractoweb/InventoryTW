"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";

import { amplifyClient, ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { CACHE_TAGS } from "@/lib/cache-tags";

const UpdateWarehouseSchema = z.object({
  idWarehouse: z.coerce.number().int().positive(),
  name: z.string().min(1),
});

export type UpdateWarehouseInput = z.input<typeof UpdateWarehouseSchema>;

export async function updateWarehouseAction(raw: UpdateWarehouseInput): Promise<{ success: boolean; error?: string }> {
  noStore();
  await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = UpdateWarehouseSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const res: any = await amplifyClient.models.Warehouse.update({
      idWarehouse: parsed.data.idWarehouse,
      name: parsed.data.name.trim(),
    } as any);

    if (res?.data) {
      revalidateTag(CACHE_TAGS.ref.warehouses);
      revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
      return { success: true };
    }
    return { success: false, error: (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo actualizar" };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
