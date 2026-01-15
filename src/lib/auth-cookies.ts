export const SESSION_COOKIE_NAME = "itw_session";

// Format: "<userId>.<sessionToken>" (both are opaque strings)
export function encodeSessionCookie(value: { userId: number; sessionToken: string }): string {
  return `${value.userId}.${value.sessionToken}`;
}

export function decodeSessionCookie(value: string | undefined | null): { userId: number; sessionToken: string } | null {
  if (!value) return null;
  const raw = String(value);
  const idx = raw.indexOf(".");
  if (idx <= 0) return null;
  const userIdRaw = raw.slice(0, idx);
  const token = raw.slice(idx + 1);
  const userId = Number(userIdRaw);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (!token || token.trim().length < 10) return null;
  return { userId, sessionToken: token };
}
