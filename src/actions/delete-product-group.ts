"use server";

import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { ACCESS_LEVELS, amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { listAllPages } from "@/services/amplify-list-all";
import { deleteProductGroup } from "@/services/product-group-service";

const DeleteProductGroupSchema = z.object({
  idProductGroup: z.coerce.number().int().positive(),
});

export type DeleteProductGroupInput = z.input<typeof DeleteProductGroupSchema>;

export async function deleteProductGroupAction(
  raw: DeleteProductGroupInput
): Promise<{ success: boolean; movedProducts?: number; movedChildren?: number; error?: string }> {
  noStore();

  const parsed = DeleteProductGroupSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);
    const idProductGroup = Number(parsed.data.idProductGroup);

    const currentRes = await amplifyClient.models.ProductGroup.get({ idProductGroup } as any);
    const current = (currentRes as any)?.data;
    if (!current) return { success: false, error: "Grupo no encontrado" };

    const productsRes = await listAllPages((args) =>
      amplifyClient.models.Product.list({
        ...(args ?? {}),
        filter: { productGroupId: { eq: idProductGroup } },
        limit: 200,
      } as any)
    );
    if ("error" in productsRes) return { success: false, error: productsRes.error };

    const products = (productsRes.data ?? []).filter((p: any) => Number.isFinite(Number(p?.idProduct)));

    for (const product of products) {
      const idProduct = Number((product as any).idProduct);
      const updateRes: any = await amplifyClient.models.Product.update({
        idProduct,
        productGroupId: null,
      } as any);

      if (Array.isArray(updateRes?.errors) && updateRes.errors.length) {
        return {
          success: false,
          error: `No se pudo desvincular producto ${idProduct}: ${String(updateRes.errors[0]?.message ?? "error")}`,
        };
      }
    }

    const childrenRes = await listAllPages((args) =>
      amplifyClient.models.ProductGroup.list({
        ...(args ?? {}),
        filter: { parentGroupId: { eq: idProductGroup } },
        limit: 200,
      } as any)
    );
    if ("error" in childrenRes) return { success: false, error: childrenRes.error };

    const children = (childrenRes.data ?? []).filter((g: any) => Number.isFinite(Number(g?.idProductGroup)));
    for (const child of children) {
      const childId = Number((child as any).idProductGroup);
      const updateRes: any = await amplifyClient.models.ProductGroup.update({
        idProductGroup: childId,
        parentGroupId: null,
      } as any);

      if (Array.isArray(updateRes?.errors) && updateRes.errors.length) {
        return {
          success: false,
          error: `No se pudo desvincular subgrupo ${childId}: ${String(updateRes.errors[0]?.message ?? "error")}`,
        };
      }
    }

    await deleteProductGroup({ idProductGroup });

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
      newValues: {
        deleted: true,
        movedProducts: products.length,
        movedChildren: children.length,
      },
    }).catch(() => {});

    revalidateTag(CACHE_TAGS.ref.productGroups);
    revalidateTag(CACHE_TAGS.heavy.productsMaster);
    revalidateTag(CACHE_TAGS.heavy.productsCompact);

    return { success: true, movedProducts: products.length, movedChildren: children.length };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
