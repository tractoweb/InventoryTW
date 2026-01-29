"use server";

import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export type UserListRow = {
  userId: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  accessLevel: number;
  isEnabled: boolean;
};

export async function listUsersAction(): Promise<{ data: UserListRow[]; error?: string }> {
  noStore();
  await requireSession(ACCESS_LEVELS.ADMIN);

  try {
    const res = await listAllPages<any>((args) => amplifyClient.models.User.list(args));
    if ("error" in res) return { data: [], error: res.error };

    const rows: UserListRow[] = (res.data ?? [])
      .map((u: any) => ({
        userId: Number(u?.userId ?? 0),
        username: String(u?.username ?? ""),
        firstName: u?.firstName ? String(u.firstName) : null,
        lastName: u?.lastName ? String(u.lastName) : null,
        email: u?.email ? String(u.email) : null,
        accessLevel: Number(u?.accessLevel ?? 0),
        isEnabled: u?.isEnabled !== false,
      }))
      .filter((u) => Number.isFinite(u.userId) && u.userId > 0 && u.username.length > 0);

    rows.sort((a, b) => a.userId - b.userId);
    return { data: rows };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
