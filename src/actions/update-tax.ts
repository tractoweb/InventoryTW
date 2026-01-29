"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";

const UpdateTaxSchema = z.object({
  idTax: z.coerce.number().int().positive(),
  name: z.string().min(1).optional(),
  rate: z.coerce.number().min(0).max(1000).optional(),
  code: z.string().optional(),
  isFixed: z.coerce.boolean().optional(),
  isTaxOnTotal: z.coerce.boolean().optional(),
  isEnabled: z.coerce.boolean().optional(),
});

export type UpdateTaxInput = z.input<typeof UpdateTaxSchema>;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const s = String(value);
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function updateTaxAction(raw: UpdateTaxInput): Promise<{ success: boolean; error?: string }> {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = UpdateTaxSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const input = parsed.data;

    const beforeRes: any = await amplifyClient.models.Tax.get({ idTax: Number(input.idTax) } as any);
    const before = beforeRes?.data as any;

    const payload: any = { idTax: Number(input.idTax) };
    if (input.name !== undefined) payload.name = String(input.name).trim();
    if (input.rate !== undefined) payload.rate = Number(input.rate);

    const code = normalizeOptionalString(input.code);
    if (code !== undefined) payload.code = code;

    if (input.isFixed !== undefined) payload.isFixed = Boolean(input.isFixed);
    if (input.isTaxOnTotal !== undefined) payload.isTaxOnTotal = Boolean(input.isTaxOnTotal);
    if (input.isEnabled !== undefined) payload.isEnabled = Boolean(input.isEnabled);

    const res: any = await amplifyClient.models.Tax.update(payload);
    if (res?.data) {
      revalidateTag(CACHE_TAGS.ref.taxes);
      revalidateTag(CACHE_TAGS.heavy.dashboardOverview);

      writeAuditLog({
        userId: session.userId,
        action: "UPDATE",
        tableName: "Tax",
        recordId: Number(input.idTax),
        oldValues: before
          ? {
              idTax: Number(before.idTax),
              name: before.name ?? null,
              rate: before.rate ?? null,
              code: before.code ?? null,
              isFixed: before.isFixed ?? null,
              isTaxOnTotal: before.isTaxOnTotal ?? null,
              isEnabled: before.isEnabled ?? null,
            }
          : undefined,
        newValues: payload,
      }).catch(() => {});

      return { success: true };
    }

    return { success: false, error: (res?.errors?.[0]?.message as string | undefined) ?? "No se pudo actualizar" };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
