"use server";

import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";

const ListAuditLogsSchema = z.object({
  q: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().optional(),
  tableName: z.string().optional(),
  dateFrom: z.string().optional(), // ISO
  dateTo: z.string().optional(), // ISO
  limit: z.coerce.number().int().min(1).max(200).default(50),
  nextToken: z.string().nullable().optional(),
});

export type AuditLogRow = {
  logId: string;
  timestamp: string;
  userId: number;
  userName: string | null;
  action: string;
  tableName: string;
  recordId: number;
  recordLabel: string | null;
  changedFields: string[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  oldValues: string | null;
  newValues: string | null;
};

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

function safeIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new Date(value).toISOString();
  } catch {
    return undefined;
  }
}

function safeJsonObject(raw: string | null): Record<string, any> | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as any;
    return null;
  } catch {
    return null;
  }
}

function pickRecordLabel(obj: Record<string, any> | null): string | null {
  if (!obj) return null;
  const candidates = [
    obj.name,
    obj.code,
    obj.documentNumber,
    obj.reference,
    obj.username,
    obj.email,
  ];
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s) return s;
  }
  return null;
}

function diffKeys(oldObj: Record<string, any> | null, newObj: Record<string, any> | null): string[] | null {
  if (!oldObj && !newObj) return null;
  const keys = new Set<string>([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);
  const changed: string[] = [];
  for (const k of keys) {
    const a = (oldObj ?? {})[k];
    const b = (newObj ?? {})[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
  }
  return changed.length ? changed.slice(0, 25) : [];
}

export async function listAuditLogsAction(raw?: z.input<typeof ListAuditLogsSchema>): Promise<{
  data: AuditLogRow[];
  nextToken: string | null;
  error?: string;
}> {
  noStore();

  try {
    await requireSession(ACCESS_LEVELS.ADMIN);

    const parsed = ListAuditLogsSchema.safeParse(raw ?? {});
    if (!parsed.success) return { data: [], nextToken: null, error: "Filtros inválidos" };

    const { q, userId, action, tableName, dateFrom, dateTo, limit, nextToken } = parsed.data;

    const and: any[] = [];
    if (userId && Number.isFinite(userId)) and.push({ userId: { eq: Number(userId) } });
    if (action && String(action).trim().length) and.push({ action: { eq: String(action).trim() } });
    if (tableName && String(tableName).trim().length) and.push({ tableName: { eq: String(tableName).trim() } });

    let df = safeIso(dateFrom);
    let dt = safeIso(dateTo);
    if (df && dt && df > dt) {
      const tmp = df;
      df = dt;
      dt = tmp;
    }
    if (df && dt) and.push({ timestamp: { between: [df, dt] } });
    else if (df) and.push({ timestamp: { ge: df } });
    else if (dt) and.push({ timestamp: { le: dt } });

    const filter = and.length === 0 ? undefined : and.length === 1 ? and[0] : { and };

    const res: any = await amplifyClient.models.AuditLog.list({
      limit,
      nextToken: nextToken ?? undefined,
      ...(filter ? { filter } : {}),
    } as any);

    const items: any[] = (res?.data ?? []) as any[];

    let rows: AuditLogRow[] = items
      .map((x: any) => ({
        logId: String(x?.logId ?? ""),
        timestamp: String(x?.timestamp ?? ""),
        userId: Number(x?.userId ?? 0),
        userName: null,
        action: String(x?.action ?? ""),
        tableName: String(x?.tableName ?? ""),
        recordId: Number(x?.recordId ?? 0),
        recordLabel: null,
        changedFields: null,
        ipAddress: x?.ipAddress ? String(x.ipAddress) : null,
        userAgent: x?.userAgent ? String(x.userAgent) : null,
        oldValues: x?.oldValues ? String(x.oldValues) : null,
        newValues: x?.newValues ? String(x.newValues) : null,
      }))
      .filter((r) => r.logId && Number.isFinite(r.userId) && r.userId > 0 && Number.isFinite(r.recordId) && r.recordId > 0);

    // Compute lightweight summary from JSON payloads (no extra reads).
    rows = rows.map((r) => {
      const oldObj = safeJsonObject(r.oldValues);
      const newObj = safeJsonObject(r.newValues);
      const recordLabel = pickRecordLabel(newObj) ?? pickRecordLabel(oldObj);
      const changedFields = diffKeys(oldObj, newObj);
      return { ...r, recordLabel, changedFields };
    });

    const qTerm = String(q ?? "").trim().toLowerCase();
    if (qTerm) {
      rows = rows.filter((r) => {
        const rid = String(r.recordId);
        const l = `${r.action} ${r.tableName} ${rid} ${r.timestamp} ${r.userName ?? ""} ${r.recordLabel ?? ""}`.toLowerCase();
        return l.includes(qTerm);
      });
    }

    // Enrich usernames for visible page
    const uniqueUserIds = Array.from(new Set(rows.map((r) => r.userId))).slice(0, 50);
    const userGets = await mapWithConcurrency(uniqueUserIds, 10, async (uid) => {
      const uRes: any = await amplifyClient.models.User.get({ userId: Number(uid) } as any);
      const u = uRes?.data as any;
      return { userId: uid, username: u?.username ? String(u.username) : null };
    });

    const usernameById = new Map<number, string>();
    for (const u of userGets) {
      if (u.username) usernameById.set(u.userId, u.username);
    }

    rows = rows.map((r) => ({ ...r, userName: usernameById.get(r.userId) ?? null }));

    // Most recent first
    rows.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

    return { data: rows, nextToken: res?.nextToken ?? null };
  } catch (e) {
    return { data: [], nextToken: null, error: formatAmplifyError(e) };
  }
}
