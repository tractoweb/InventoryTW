"use server";

import { revalidateTag } from "next/cache";

import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { CACHE_TAGS } from "@/lib/cache-tags";

export async function refreshStockCache(): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSession(ACCESS_LEVELS.CASHIER);
  } catch (e: any) {
    return { success: false, error: e?.message || "No autorizado" };
  }

  try {
    revalidateTag(CACHE_TAGS.heavy.stockData);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "No se pudo refrescar." };
  }
}
