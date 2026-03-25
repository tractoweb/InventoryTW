"use server";

import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { ACCESS_LEVELS, amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { listAllPages } from "@/services/amplify-list-all";

const DeleteProductGroupSchema = z.object({
  idProductGroup: z.coerce.number().int().positive(),
});

export type DeleteProductGroupInput = z.input<typeof DeleteProductGroupSchema>;

export async function deleteProductGroupAction(
  raw: DeleteProductGroupInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = DeleteProductGroupSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);
    const idProductGroup = Number(parsed.data.idProductGroup);

    // Verify group exists
    const currentRes = await amplifyClient.models.ProductGroup.get({ idProductGroup } as any);
    const current = (currentRes as any)?.data;
    if (!current) return { success: false, error: "Grupo no encontrado" };

    // Check for products in this group
    const productsRes = await listAllPages((args) =>
      amplifyClient.models.Product.list({
        ...(args ?? {}),
        filter: { productGroupId: { eq: idProductGroup } },
        limit: 100,
      } as any)
    );

    if ("error" in productsRes) return { success: false, error: productsRes.error };
    const products = productsRes.data ?? [];

    if (products.length > 0) {
      return { success: false, error: `Este grupo tiene ${products.length} producto(s) vinculado(s). Desvincula los productos antes de eliminar.` };
    }

    // Check for child groups
    const childrenRes = await listAllPages((args) =>
      amplifyClient.models.ProductGroup.list({
        ...(args ?? {}),
        filter: { parentGroupId: { eq: idProductGroup } },
        limit: 100,
      } as any)
    );

    if ("error" in childrenRes) return { success: false, error: childrenRes.error };
    const children = childrenRes.data ?? [];

    if (children.length > 0) {
      return { success: false, error: `Este grupo tiene ${children.length} subgrupo(s). Desvincula los subgrupos antes de eliminar.` };
    }

    // Delete the group
    const deleteRes: any = await amplifyClient.models.ProductGroup.delete({ idProductGroup } as any);
    
    if (Array.isArray(deleteRes?.errors) && deleteRes.errors.length) {
      return { success: false, error: String(deleteRes.errors[0]?.message ?? "Error al eliminar") };
    }

    // Log the deletion
    writeAuditLog({
      userId: session.userId,
      action: "DELETE",
      tableName: "ProductGroup",
      recordId: idProductGroup,
      oldValues: {
        idProductGroup,
        name: current?.name ?? null,
        parentGroupId: current?.parentGroupId ?? null,
        color: current?.color ?? null,
        rank: current?.rank ?? null,
      },
      newValues: { deleted: true },
    }).catch(() => {});

    revalidateTag(CACHE_TAGS.ref.productGroups);
    revalidateTag(CACHE_TAGS.heavy.productsMaster);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
