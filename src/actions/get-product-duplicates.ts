"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export type ProductDuplicateItem = {
  idProduct: number;
  name: string;
  code: string | null;
};

export type ProductDuplicateGroup = {
  key: string;
  reason: "name" | "code";
  items: ProductDuplicateItem[];
};

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^0-9A-Z]+/g, "");
}

export async function getProductDuplicatesAction(): Promise<{ data?: ProductDuplicateGroup[]; error?: string }> {
  noStore();
  try {
    const res = await listAllPages<any>((a) => amplifyClient.models.Product.list(a));
    if ("error" in res) return { error: res.error };

    const products: ProductDuplicateItem[] = (res.data ?? [])
      .map((p: any) => ({
        idProduct: Number(p?.idProduct ?? 0),
        name: String(p?.name ?? "").trim(),
        code: p?.code ? String(p.code).trim() : null,
      }))
      .filter((p) => Number.isFinite(p.idProduct) && p.idProduct > 0 && p.name.length > 0);

    const byName = new Map<string, ProductDuplicateItem[]>();
    const byCode = new Map<string, ProductDuplicateItem[]>();

    for (const p of products) {
      const nk = normalizeKey(p.name);
      if (nk.length >= 6) {
        const arr = byName.get(nk) ?? [];
        arr.push(p);
        byName.set(nk, arr);
      }

      const ck = p.code ? normalizeKey(p.code) : "";
      if (ck.length >= 3) {
        const arr = byCode.get(ck) ?? [];
        arr.push(p);
        byCode.set(ck, arr);
      }
    }

    const groups: ProductDuplicateGroup[] = [];

    for (const [key, items] of byCode.entries()) {
      if (items.length <= 1) continue;
      groups.push({ key, reason: "code", items: items.slice().sort((a, b) => a.idProduct - b.idProduct) });
    }

    for (const [key, items] of byName.entries()) {
      if (items.length <= 1) continue;
      // Skip name-groups that are already fully captured by same-code groups.
      groups.push({ key, reason: "name", items: items.slice().sort((a, b) => a.idProduct - b.idProduct) });
    }

    // Show code-duplicates first (usually higher confidence)
    groups.sort((a, b) => {
      if (a.reason !== b.reason) return a.reason === "code" ? -1 : 1;
      return b.items.length - a.items.length;
    });

    return { data: groups };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
