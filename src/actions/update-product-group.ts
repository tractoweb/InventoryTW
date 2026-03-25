"use server";

import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { ACCESS_LEVELS, amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { updateProductGroup } from "@/services/product-group-service";

const OptionalPositiveInt = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : value;
  },
  z.number().int().positive().optional()
);

const OptionalRankInt = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : value;
  },
  z.number().int().min(0).max(100000).optional()
);

const UpdateProductGroupSchema = z.object({
  idProductGroup: z.coerce.number().int().positive(),
  name: z.string().min(1).max(120),
  parentGroupId: OptionalPositiveInt,
  color: z.string().max(32).optional(),
  rank: OptionalRankInt,
});

export type UpdateProductGroupInput = z.input<typeof UpdateProductGroupSchema>;

export async function updateProductGroupAction(
  raw: UpdateProductGroupInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = UpdateProductGroupSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);

    const input = parsed.data;
    const idProductGroup = Number(input.idProductGroup);
    const name = String(input.name ?? "").trim();
    const parentGroupId = input.parentGroupId;
    const color = input.color !== undefined ? String(input.color ?? "").trim() || null : null;
    const rank = input.rank ?? null;

    if (!name) return { success: false, error: "El nombre es obligatorio" };
    if (parentGroupId !== undefined && parentGroupId === idProductGroup) {
      return { success: false, error: "Un grupo no puede ser su propio padre" };
    }

    const currentRes = await amplifyClient.models.ProductGroup.get({ idProductGroup } as any);
    const current = (currentRes as any)?.data;
    if (!current) return { success: false, error: "Grupo no encontrado" };

    if (parentGroupId !== undefined) {
      const parentRes = await amplifyClient.models.ProductGroup.get({ idProductGroup: parentGroupId } as any);
      if (!(parentRes as any)?.data) {
        return { success: false, error: "El grupo padre no existe" };
      }
    }

    await updateProductGroup({
      idProductGroup,
      name,
      parentGroupId: parentGroupId ?? null,
      color,
      rank,
    });

    writeAuditLog({
      userId: session.userId,
      action: "UPDATE",
      tableName: "ProductGroup",
      recordId: idProductGroup,
      oldValues: {
        idProductGroup,
        name: current?.name ?? null,
        parentGroupId: current?.parentGroupId ?? null,
        color: current?.color ?? null,
        rank: current?.rank ?? null,
      },
      newValues: {
        idProductGroup,
        name,
        parentGroupId: parentGroupId ?? null,
        color,
        rank,
      },
    }).catch(() => {});

    revalidateTag(CACHE_TAGS.ref.productGroups);
    revalidateTag(CACHE_TAGS.heavy.productsMaster);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
