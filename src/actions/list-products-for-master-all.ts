"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

import type { ProductsMasterRow } from "@/actions/list-products-for-master";

export async function listProductsForMasterAll(args?: {
  groupId?: number | null;
}): Promise<{ data: ProductsMasterRow[]; error?: string }> {
  noStore();

  try {
    const groupId = args?.groupId === undefined || args?.groupId === null ? null : Number(args.groupId);
    const filter = groupId && Number.isFinite(groupId) ? ({ productGroupId: { eq: groupId } } as any) : undefined;

    const res = await listAllPages<any>((listArgs) => amplifyClient.models.Product.list(listArgs), filter ? { filter } : undefined);
    if ("error" in res) return { data: [], error: res.error };

    const rows: ProductsMasterRow[] = (res.data ?? [])
      .map((p: any) => {
        const id = Number(p?.idProduct ?? 0);
        const pgid = p?.productGroupId !== undefined && p?.productGroupId !== null ? Number(p.productGroupId) : null;

        return {
          id,
          name: String(p?.name ?? ""),
          code: p?.code ? String(p.code) : null,
          productGroupId: pgid && Number.isFinite(pgid) ? pgid : null,
          measurementUnit: p?.measurementUnit ? String(p.measurementUnit) : null,
          cost: p?.cost !== undefined && p?.cost !== null ? Number(p.cost) : null,
          price: p?.price !== undefined && p?.price !== null ? Number(p.price) : null,
          isEnabled: p?.isEnabled !== false,
          createdAt: p?.createdAt ? String(p.createdAt) : null,
          updatedAt: p?.updatedAt ? String(p.updatedAt) : null,
        };
      })
      .filter((r: any) => Number.isFinite(r.id) && r.id > 0 && r.name.length > 0)
      // Default behavior: exclude soft-deleted products
      .filter((r) => r.isEnabled);

    // Stable order so pagination/sorting in UI is consistent
    rows.sort((a, b) => a.id - b.id);

    return { data: rows };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
