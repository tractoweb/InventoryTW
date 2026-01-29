"use server";

import { unstable_noStore as noStore } from "next/cache";

import { DOCUMENT_STOCK_DIRECTION, formatAmplifyError, normalizeStockDirection } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";

export type NotificationItem = {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  href?: string | null;
};

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ymdToday(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = String(ymd).split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYmdToUtcMidnight(ymd: string): Date {
  const [y, m, d] = String(ymd).split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function isVoidedOrVoidDoc(doc: any): boolean {
  const note = String(doc?.note ?? "");
  const internalNote = String(doc?.internalNote ?? "");
  if (note.includes("ANULADO_ID:")) return true;
  if (internalNote.includes('"kind":"Void"') || internalNote.includes("\"kind\":\"Void\"")) return true;
  if (internalNote.includes('"reversesDocumentId"') || internalNote.includes("\"reversesDocumentId\"")) return true;
  return false;
}

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
    await requireSession();

    const hardLimit = Math.max(10, Math.min(200, Number(limit) || 10));
    const maxOut = Math.max(1, Math.min(50, Number(limit) || 10));

    // 1) Recent document-related audit logs (global, not per-user).
    const auditRes: any = await amplifyClient.models.AuditLog.list({
      filter: { tableName: { eq: "Document" } },
      limit: hardLimit,
    } as any);
    const auditRows: any[] = (auditRes?.data ?? []) as any[];
    const auditItems: NotificationItem[] = auditRows
      .map((r) => {
        const action = String(r?.action ?? "ACT");
        const table = String(r?.tableName ?? "");
        const recordId = Number(r?.recordId ?? 0);
        const ts = String(r?.timestamp ?? "");

        return {
          id: String(r?.logId ?? `${table}-${recordId}-${ts}`),
          title: `${action} · ${table}`,
          description: Number.isFinite(recordId) && recordId > 0 ? `Documento: ${recordId}` : null,
          createdAt: ts,
          href: pickHref(r),
        } satisfies NotificationItem;
      })
      .filter((n) => n.createdAt)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, Math.max(1, Math.min(20, maxOut)));

    // 2) Receivables alerts (sales docs unpaid/partial) for recent window.
    const today = ymdToday();
    const from = addDaysYmd(today, -180);

    const docTypesResult = await listAllPages<any>((a) => amplifyClient.models.DocumentType.list(a));
    if ("error" in docTypesResult) return { data: auditItems.slice(0, maxOut), error: docTypesResult.error };
    const stockDirectionByDocTypeId = new Map<number, number>();
    for (const dt of docTypesResult.data ?? []) {
      const id = Number((dt as any)?.documentTypeId);
      const sd = normalizeStockDirection((dt as any)?.stockDirection);
      if (Number.isFinite(id) && id > 0) stockDirectionByDocTypeId.set(id, sd);
    }

    const docsResult = await listAllPages<any>((a) =>
      amplifyClient.models.Document.list({
        ...(a ?? {}),
        filter: {
          date: { ge: from, le: today },
        },
      } as any)
    );
    if ("error" in docsResult) return { data: auditItems.slice(0, maxOut), error: docsResult.error };

    const salesPendingDocs = (docsResult.data ?? [])
      .filter((d: any) => {
        const dtId = Number(d?.documentTypeId);
        const sd = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
        return sd === DOCUMENT_STOCK_DIRECTION.OUT;
      })
      .filter((d: any) => Boolean(d?.isClockedOut))
      .filter((d: any) => !isVoidedOrVoidDoc(d))
      .filter((d: any) => safeNumber(d?.total, 0) > 0)
      .filter((d: any) => Number(d?.paidStatus ?? 0) !== 2);

    const pendingDocIds = new Set<number>();
    for (const d of salesPendingDocs) {
      const docId = Number(d?.documentId);
      if (Number.isFinite(docId) && docId > 0) pendingDocIds.add(docId);
    }

    const paymentSumsByDocId = new Map<number, number>();
    if (pendingDocIds.size > 0) {
      const paymentsResult = await listAllPages<any>((a) => amplifyClient.models.Payment.list(a));
      if ("error" in paymentsResult) return { data: auditItems.slice(0, maxOut), error: paymentsResult.error };
      for (const p of paymentsResult.data ?? []) {
        const docId = Number((p as any)?.documentId);
        if (!pendingDocIds.has(docId)) continue;
        paymentSumsByDocId.set(docId, (paymentSumsByDocId.get(docId) ?? 0) + Math.max(0, safeNumber((p as any)?.amount, 0)));
      }
    }

    const now = new Date();
    const receivables = salesPendingDocs
      .map((d: any) => {
        const documentId = Number(d?.documentId);
        const number = String(d?.number ?? "").trim();
        const clientName = String(d?.clientNameSnapshot ?? "").trim() || "Anónimo";
        const total = safeNumber(d?.total, 0);
        const paidApprox = safeNumber(paymentSumsByDocId.get(documentId) ?? 0, 0);
        const pendingApprox = Math.max(0, total - paidApprox);
        const dueDate = d?.dueDate ? String(d.dueDate) : null;

        let daysOverdue = 0;
        if (dueDate) {
          const due = parseYmdToUtcMidnight(dueDate);
          const diffMs = now.getTime() - due.getTime();
          daysOverdue = diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
        }

        return {
          documentId,
          number,
          clientName,
          pendingApprox,
          dueDate,
          daysOverdue,
        };
      })
      .filter((r) => Number.isFinite(r.documentId) && r.documentId > 0 && r.pendingApprox > 0);

    const topOverdue = receivables
      .filter((r) => r.daysOverdue > 0)
      .slice()
      .sort((a, b) => {
        if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
        return b.pendingApprox - a.pendingApprox;
      })
      .slice(0, 6);

    const topPending = receivables
      .filter((r) => r.daysOverdue <= 0)
      .slice()
      .sort((a, b) => b.pendingApprox - a.pendingApprox)
      .slice(0, 4);

    const receivableItems: NotificationItem[] = [...topOverdue, ...topPending]
      .map((r) => {
        const dueSuffix = r.dueDate ? ` · Vence ${r.dueDate}` : "";
        const overdueSuffix = r.daysOverdue > 0 ? ` · ${r.daysOverdue} día(s) vencido` : "";
        return {
          id: `receivable-${r.documentId}`,
          title: r.daysOverdue > 0 ? "Por cobrar · Vencido" : "Por cobrar",
          description: `${r.clientName} · Doc ${r.number || r.documentId} · Pendiente ${Math.round(r.pendingApprox).toLocaleString("es-CO")}${dueSuffix}${overdueSuffix}`,
          createdAt: now.toISOString(),
          href: `/documents/${r.documentId}/pdf`,
        } satisfies NotificationItem;
      })
      .slice(0, Math.max(1, Math.min(12, maxOut)));

    const combined = [...receivableItems, ...auditItems]
      .filter((n) => n.createdAt)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, maxOut);

    return { data: combined };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
