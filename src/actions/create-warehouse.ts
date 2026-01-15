"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";

const CreateWarehouseSchema = z.object({
  name: z.string().min(1),
});

export type CreateWarehouseInput = z.input<typeof CreateWarehouseSchema>;

async function getNextWarehouseId(): Promise<number> {
  const result = await listAllPages<any>((args) => amplifyClient.models.Warehouse.list(args));
  if ("error" in result) throw new Error(result.error);

  const rows = result.data ?? [];
  let maxId = 0;
  for (const w of rows as any[]) {
    const id = Number(w?.idWarehouse);
    if (Number.isFinite(id) && id > maxId) maxId = id;
  }
  return maxId + 1;
}

export async function createWarehouseAction(raw: CreateWarehouseInput): Promise<{ success: boolean; error?: string }> {
  noStore();
  await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = CreateWarehouseSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const idWarehouse = await getNextWarehouseId();
    const res: any = await amplifyClient.models.Warehouse.create({
      idWarehouse,
      name: parsed.data.name.trim(),
    } as any);

    if (res?.data) return { success: true };
    return { success: false, error: (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo crear" };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
