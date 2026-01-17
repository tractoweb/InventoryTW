"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";

export type NotificationItem = {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  href?: string | null;
};

function pickHref(row: any): string | null {
  const table = String(row?.tableName ?? "");
  const id = Number(row?.recordId);
  if (!Number.isFinite(id) || id <= 0) return null;

  if (table === "Document") return `/documents/${id}/pdf`;
  if (table === "Product") return `/inventory/${id}`;

  return null;
}

export async function listNotificationsAction(limit = 10): Promise<{ data: NotificationItem[]; error?: string }> {
  noStore();

  try {
    const session = await requireSession();

    const res: any = await amplifyClient.models.AuditLog.list({
      filter: { userId: { eq: Number(session.userId) } },
      limit: Math.max(10, Math.min(200, Number(limit) || 10)),
    } as any);

    const rows: any[] = (res?.data ?? []) as any[];

    const items = rows
      .map((r) => {
        const action = String(r?.action ?? "ACT");
        const table = String(r?.tableName ?? "");
        const recordId = Number(r?.recordId ?? 0);
        const ts = String(r?.timestamp ?? "");

        return {
          id: String(r?.logId ?? `${table}-${recordId}-${ts}`),
          title: `${action} · ${table}`,
          description: Number.isFinite(recordId) && recordId > 0 ? `Registro: ${recordId}` : null,
          createdAt: ts,
          href: pickHref(r),
        } satisfies NotificationItem;
      })
      .filter((n) => n.createdAt)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));

    return { data: items };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
