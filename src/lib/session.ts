import "server-only";

import { cookies } from "next/headers";

import { decodeSessionCookie, encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth-cookies";
import { ACCESS_LEVELS, type AccessLevel, formatAmplifyError } from "@/lib/amplify-config";
import { logoutUser, validateSession } from "@/services/auth-service";

export type CurrentSession = {
  userId: number;
  accessLevel: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  sessionToken: string;
};

export function getSessionFromCookies(): { userId: number; sessionToken: string } | null {
  const c = cookies();
  return decodeSessionCookie(c.get(SESSION_COOKIE_NAME)?.value);
}

export async function getCurrentSession(): Promise<{ data?: CurrentSession; error?: string }> {
  const parsed = getSessionFromCookies();
  if (!parsed) return { error: "No autenticado" };

  try {
    const res = await validateSession(parsed.userId, parsed.sessionToken);
    if (!res?.valid || !res?.session) return { error: "Sesión inválida" };

    const s: any = res.session;
    return {
      data: {
        userId: Number(s?.userId ?? parsed.userId),
        accessLevel: Number(s?.accessLevel ?? ACCESS_LEVELS.CASHIER),
        firstName: s?.firstName ?? null,
        lastName: s?.lastName ?? null,
        email: s?.email ?? null,
        sessionToken: String(s?.sessionToken ?? parsed.sessionToken),
      },
    };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}

export async function requireSession(requiredLevel: AccessLevel = ACCESS_LEVELS.CASHIER): Promise<CurrentSession> {
  const res = await getCurrentSession();
  if (!res.data) throw new Error(res.error || "No autenticado");
  if (Number(res.data.accessLevel) < requiredLevel) throw new Error("No autorizado");
  return res.data;
}

export function setSessionCookie(value: { userId: number; sessionToken: string }) {
  const c = cookies();
  c.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSessionCookie(value),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearSessionCookie() {
  const c = cookies();
  c.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function logoutCurrentSession(): Promise<{ success: boolean; error?: string }> {
  const parsed = getSessionFromCookies();
  if (!parsed) {
    clearSessionCookie();
    return { success: true };
  }

  const res = await logoutUser(parsed.userId, parsed.sessionToken);
  clearSessionCookie();
  return res;
}
