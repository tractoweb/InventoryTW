"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";

const Schema = z.object({
  warehouseId: z.coerce.number().int().positive(),
  defaultDocumentTypeId: z.union([z.coerce.number().int().positive(), z.null()]),
});

function keyForWarehouse(warehouseId: number): string {
  return `posSalidas.defaultDocumentTypeId.${warehouseId}`;
}

export async function updatePosSalidasConfigAction(raw: z.input<typeof Schema>): Promise<{
  success: boolean;
  error?: string;
}> {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.MASTER);

  const parsed = Schema.safeParse(raw ?? {});
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const warehouseId = Number(parsed.data.warehouseId);
  const defaultDocumentTypeId = parsed.data.defaultDocumentTypeId === null ? null : Number(parsed.data.defaultDocumentTypeId);

  const name = keyForWarehouse(warehouseId);

  try {
    const beforeRes: any = await amplifyClient.models.ApplicationProperty.get({ name } as any).catch(() => null);
    const before = beforeRes?.data ? { ...beforeRes.data } : undefined;

    if (defaultDocumentTypeId === null) {
      if (beforeRes?.data) {
        await amplifyClient.models.ApplicationProperty.delete({ name } as any);
        writeAuditLog({
          userId: session.userId,
          action: "DELETE",
          tableName: "ApplicationProperty",
          recordId: warehouseId,
          oldValues: before,
          newValues: { name, value: null },
        }).catch(() => {});
      }
      return { success: true };
    }

    const payload: any = {
      name,
      value: String(defaultDocumentTypeId),
    };

    const res: any = beforeRes?.data
      ? await amplifyClient.models.ApplicationProperty.update(payload)
      : await amplifyClient.models.ApplicationProperty.create(payload);

    if (res?.data) {
      writeAuditLog({
        userId: session.userId,
        action: "UPDATE",
        tableName: "ApplicationProperty",
        recordId: warehouseId,
        oldValues: before,
        newValues: payload,
      }).catch(() => {});
      return { success: true };
    }

    const msg = (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo guardar";
    return { success: false, error: msg };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
