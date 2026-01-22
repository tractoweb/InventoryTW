"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";

export type ProductTreeItem = {
  idProduct: number;
  name: string;
  code: string | null;
};

export async function listProductsByGroup(args: {
  groupId: number;
  q?: string;
  limit?: number;
}): Promise<{ data?: ProductTreeItem[]; error?: string }> {
  noStore();

  try {
    const groupId = Number(args?.groupId);
    if (!Number.isFinite(groupId) || groupId <= 0) return { data: [] };

    const q = String(args?.q ?? "").trim().toLowerCase();
    const limit = Number.isFinite(Number(args?.limit)) ? Math.max(1, Math.trunc(Number(args.limit))) : 200;

    const result: any = await amplifyClient.models.Product.list({
      filter: { productGroupId: { eq: groupId } },
      limit,
    } as any);

    const rows = ((result as any)?.data ?? [])
      .map((p: any) => ({
        idProduct: Number(p?.idProduct ?? 0),
        name: String(p?.name ?? ""),
        code: p?.code ? String(p.code) : null,
        isEnabled: p?.isEnabled !== false,
      }))
      .filter((p: any) => Number.isFinite(p.idProduct) && p.idProduct > 0 && p.name.length > 0)
      .filter((p: any) => p.isEnabled);

    const filtered = q
      ? rows.filter((p: any) => p.name.toLowerCase().includes(q) || String(p.idProduct).includes(q) || String(p.code ?? "").toLowerCase().includes(q))
      : rows;

    filtered.sort((a: any, b: any) => a.name.localeCompare(b.name));
    return { data: filtered.slice(0, limit) };
  } catch (error) {
    return { error: formatAmplifyError(error) };
  }
}
