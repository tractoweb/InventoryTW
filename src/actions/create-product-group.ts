"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { allocateCounterRange, ensureCounterAtLeast } from "@/lib/allocate-counter-range";
import { listAllPages } from "@/services/amplify-list-all";
import { createProductGroup } from "@/services/product-group-service";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getCurrentSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";

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

const CreateProductGroupSchema = z.object({
  name: z.string().min(1).max(120),
  parentGroupId: OptionalPositiveInt,
  color: z.string().max(32).optional(),
  rank: OptionalRankInt,
});

export type CreateProductGroupInput = z.input<typeof CreateProductGroupSchema>;

export async function createProductGroupAction(
  raw: CreateProductGroupInput
): Promise<{ success: boolean; idProductGroup?: number; error?: string }> {
  noStore();
  try {
    const parsed = CreateProductGroupSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Datos inválidos" };

    const input = parsed.data;
    const name = String(input.name ?? "").trim();
    if (!name) return { success: false, error: "El nombre es obligatorio" };
    const parentGroupId = input.parentGroupId;
    const color = input.color !== undefined ? String(input.color ?? "").trim() || undefined : undefined;
    const rank = input.rank;

    if (parentGroupId !== undefined) {
      const parentRes = await amplifyClient.models.ProductGroup.get({ idProductGroup: parentGroupId } as any);
      if (!(parentRes as any)?.data) {
        return { success: false, error: "El grupo padre no existe" };
      }
    }

    let seededCounter = false;
    let collisionCount = 0;

    async function seedCounterFromExisting() {
      const existingGroups = await listAllPages((args) => amplifyClient.models.ProductGroup.list(args));
      if ("error" in existingGroups) {
        throw new Error(existingGroups.error);
      }

      const maxExistingId = existingGroups.data.reduce((max, g: any) => {
        const id = Number(g?.idProductGroup ?? 0);
        return Number.isFinite(id) ? Math.max(max, id) : max;
      }, 0);

      await ensureCounterAtLeast("productGroupId", maxExistingId);
      seededCounter = true;
    }

    // Seed counter ONLY if it doesn't exist yet.
    const counterRes = await amplifyClient.models.Counter.get({ name: "productGroupId" });
    if (!counterRes.data) {
      await seedCounterFromExisting();
    }

    for (let attempt = 0; attempt < 50; attempt++) {
      const [idProductGroup] = await allocateCounterRange("productGroupId", 1);
      const existing = await amplifyClient.models.ProductGroup.get({ idProductGroup });
      if ((existing as any)?.data) {
        collisionCount++;
        if (!seededCounter && collisionCount >= 5) {
          await seedCounterFromExisting();
        }
        continue;
      }

      const created = await createProductGroup({ idProductGroup, name, parentGroupId, color, rank });

      if (created) {
        const sessionRes = await getCurrentSession();
        if (sessionRes.data?.userId) {
          writeAuditLog({
            userId: sessionRes.data.userId,
            action: "CREATE",
            tableName: "ProductGroup",
            recordId: idProductGroup,
            newValues: {
              idProductGroup,
              name,
              parentGroupId: parentGroupId ?? null,
              color: color ?? null,
              rank: rank ?? null,
            },
          }).catch(() => {});
        }

        revalidateTag(CACHE_TAGS.ref.productGroups);
        revalidateTag(CACHE_TAGS.heavy.productsMaster);
        return { success: true, idProductGroup };
      }
    }

    return { success: false, error: "No se pudo asignar un ID libre para el grupo" };
  } catch (error: any) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
