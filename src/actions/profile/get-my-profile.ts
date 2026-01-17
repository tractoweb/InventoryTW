"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";

export type MyProfile = {
  userId: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export async function getMyProfileAction(): Promise<{ data?: MyProfile; error?: string }> {
  noStore();

  try {
    const session = await requireSession();

    const userRes: any = await amplifyClient.models.User.get({ userId: Number(session.userId) } as any);
    const u = userRes?.data as any;

    // Fallback to session fields if the User row is missing/incomplete.
    return {
      data: {
        userId: Number(session.userId),
        username: String(u?.username ?? ""),
        firstName: (u?.firstName ?? session.firstName ?? null) as any,
        lastName: (u?.lastName ?? session.lastName ?? null) as any,
        email: (u?.email ?? session.email ?? null) as any,
      },
    };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
