"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { authenticateUser } from "@/services/auth-service";
import { setSessionCookie } from "@/lib/session";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function loginAction(raw: z.input<typeof LoginSchema>): Promise<{ success: boolean; error?: string }> {
  noStore();
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const res = await authenticateUser(parsed.data.username, parsed.data.password);
  if (!res.success || !res.user || !res.sessionToken) {
    return { success: false, error: res.error || "Credenciales inválidas" };
  }

  setSessionCookie({ userId: Number(res.user.id), sessionToken: res.sessionToken });
  return { success: true };
}
