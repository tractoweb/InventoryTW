"use server";

import { unstable_noStore as noStore } from "next/cache";

import { getCurrentSession } from "@/lib/session";

export async function getCurrentSessionAction() {
  noStore();
  return getCurrentSession();
}
