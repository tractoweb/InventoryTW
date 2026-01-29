"use server";

import "server-only";

import { amplifyClient } from "@/lib/amplify-server";

export type RealtimeAuditToastRow = {
  logId: string;
  action: string;
  tableName: string;
  recordId: number;
  timestamp: string;
};

const TOAST_ACTIONS = ["CREATE", "UPDATE", "DELETE", "HARD_DELETE", "SOFT_DELETE"] as const;

export async function getRealtimeAuditLogsAction(args: {
  sinceIso: string;
  limit?: number;
}): Promise<{ data: RealtimeAuditToastRow[]; error?: string }> {
  const limit = Math.min(Math.max(Number(args.limit ?? 50), 1), 200);
  const sinceIso = String(args.sinceIso ?? "").trim();

  if (!sinceIso) return { data: [], error: "sinceIso requerido" };

  try {
    const res: any = await (amplifyClient as any).models.AuditLog.list({
      limit,
      filter: {
        and: [
          { timestamp: { ge: sinceIso } },
          { action: { in: TOAST_ACTIONS as unknown as string[] } },
        ],
      },
    } as any);

    if (res?.errors?.length) {
      return { data: [], error: String(res.errors?.[0]?.message ?? "Error") };
    }

    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return {
      data: rows.map((r) => ({
        logId: String(r?.logId ?? ""),
        action: String(r?.action ?? ""),
        tableName: String(r?.tableName ?? ""),
        recordId: Number(r?.recordId ?? 0),
        timestamp: String(r?.timestamp ?? ""),
      })),
    };
  } catch (e: any) {
    return { data: [], error: String(e?.message ?? "Error") };
  }
}
