import "server-only";

import { headers } from "next/headers";
import { randomUUID } from "crypto";

import { amplifyClient } from "@/lib/amplify-config";

export type AuditLogAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "HARD_DELETE"
  | "SOFT_DELETE"
  | "CLOCK_OUT";

export type AuditLogEntryInput = {
  userId: number;
  action: AuditLogAction | (string & {});
  tableName: string;
  recordId: number;
  oldValues?: unknown;
  newValues?: unknown;
};

function safeStringify(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getAuditRequestMeta(): { ipAddress?: string; userAgent?: string } {
  try {
    const h = headers();
    const userAgent = h.get("user-agent") ?? undefined;

    // Best-effort behind proxies (App Hosting / Vercel / ALB)
    const xff = h.get("x-forwarded-for");
    const ipAddress = xff ? xff.split(",")[0]?.trim() : h.get("x-real-ip") ?? undefined;

    return { ipAddress: ipAddress || undefined, userAgent };
  } catch {
    return {};
  }
}

export async function writeAuditLog(input: AuditLogEntryInput): Promise<void> {
  const userId = Number(input.userId);
  const recordId = Number(input.recordId);
  if (!Number.isFinite(userId) || userId <= 0) return;
  if (!Number.isFinite(recordId) || recordId <= 0) return;

  const meta = getAuditRequestMeta();

  try {
    await amplifyClient.models.AuditLog.create({
      logId: randomUUID(),
      userId,
      action: String(input.action),
      tableName: String(input.tableName),
      recordId,
      oldValues: safeStringify(input.oldValues),
      newValues: safeStringify(input.newValues),
      timestamp: new Date().toISOString(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    } as any);
  } catch {
    // Never block business operations due to audit failures.
  }
}
