"use server";

import { unstable_noStore as noStore } from "next/cache";

import { logoutCurrentSession } from "@/lib/session";

export async function logoutAction(): Promise<{ success: boolean; error?: string }> {
  noStore();
  return logoutCurrentSession();
}
