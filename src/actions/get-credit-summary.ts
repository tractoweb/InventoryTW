"use server";

import { unstable_noStore as noStore } from "next/cache";

import { amplifyClient, DOCUMENT_STOCK_DIRECTION, formatAmplifyError, normalizeStockDirection } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";

export type CreditDocRow = {
  documentId: number;
  number: string;
  date: string;
  dueDate?: string | null;
  pendingApprox: number;
  daysOverdue: number;
  href: string;
};

export type CreditPartyRow = {
  partyKey: string;
  partyId?: number | null;
  name: string;
  email?: string | null;
  pendingApprox: number;
  overdueApprox: number;
  docs: CreditDocRow[];
};

export type CreditSummary = {
  clients: CreditPartyRow[];
  suppliers: CreditPartyRow[];
  generatedAt: string;
  window: { from: string; to: string };
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

function safeJsonParse(value: unknown): any | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isVoidedOrVoidDoc(doc: any): boolean {
  const note = String(doc?.note ?? "");
  const internalNote = String(doc?.internalNote ?? "");
  if (note.includes("ANULADO_ID:")) return true;
  if (internalNote.includes('"kind":"Void"') || internalNote.includes("\"kind\":\"Void\"")) return true;
  if (internalNote.includes('"reversesDocumentId"') || internalNote.includes("\"reversesDocumentId\"")) return true;
  return false;
}

function topDocs(docs: CreditDocRow[], max = 5): CreditDocRow[] {
  return docs
    .slice()
    .sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return b.pendingApprox - a.pendingApprox;
    })
    .slice(0, max);
}

export async function getCreditSummaryAction(daysWindow = 365): Promise<{ data?: CreditSummary; error?: string }> {
  noStore();

  try {
    await requireSession();

    const to = ymdToday();
    const from = addDaysYmd(to, -Math.max(30, Math.min(3650, Number(daysWindow) || 365)));

    const [docTypesRes, docsRes, paymentsRes, clientsRes, customersRes] = await Promise.all([
      listAllPages<any>((a) => amplifyClient.models.DocumentType.list(a)),
      listAllPages<any>((a) =>
        amplifyClient.models.Document.list({
          ...(a ?? {}),
          filter: {
            date: { ge: from, le: to },
          },
        } as any)
      ),
      listAllPages<any>((a) => amplifyClient.models.Payment.list(a)),
      listAllPages<any>((a) => amplifyClient.models.Client.list(a)),
      listAllPages<any>((a) => amplifyClient.models.Customer.list(a)),
    ]);

    if ("error" in docTypesRes) return { error: docTypesRes.error };
    if ("error" in docsRes) return { error: docsRes.error };
    if ("error" in paymentsRes) return { error: paymentsRes.error };

    const stockDirectionByDocTypeId = new Map<number, number>();
    for (const dt of docTypesRes.data ?? []) {
      const id = Number((dt as any)?.documentTypeId);
      const sd = normalizeStockDirection((dt as any)?.stockDirection);
      if (Number.isFinite(id) && id > 0) stockDirectionByDocTypeId.set(id, sd);
    }

    const clientById = new Map<number, { name: string; email?: string | null }>();
    if (!("error" in clientsRes)) {
      for (const c of clientsRes.data ?? []) {
        const id = Number((c as any)?.idClient);
        if (!Number.isFinite(id) || id <= 0) continue;
        clientById.set(id, {
          name: String((c as any)?.name ?? "").trim() || `#${id}`,
          email: (c as any)?.email ? String((c as any).email).trim() : null,
        });
      }
    }

    const supplierById = new Map<number, { name: string; email?: string | null }>();
    if (!("error" in customersRes)) {
      for (const c of customersRes.data ?? []) {
        const id = Number((c as any)?.idCustomer);
        if (!Number.isFinite(id) || id <= 0) continue;
        supplierById.set(id, {
          name: String((c as any)?.name ?? "").trim() || `#${id}`,
          email: (c as any)?.email ? String((c as any).email).trim() : null,
        });
      }
    }

    const paymentSumsByDocId = new Map<number, number>();
    for (const p of paymentsRes.data ?? []) {
      const docId = Number((p as any)?.documentId);
      if (!Number.isFinite(docId) || docId <= 0) continue;
      paymentSumsByDocId.set(docId, (paymentSumsByDocId.get(docId) ?? 0) + Math.max(0, safeNumber((p as any)?.amount, 0)));
    }

    const now = new Date();

    const clientsAgg = new Map<string, CreditPartyRow>();
    const suppliersAgg = new Map<string, CreditPartyRow>();

    for (const d of docsRes.data ?? []) {
      const documentId = Number(d?.documentId);
      if (!Number.isFinite(documentId) || documentId <= 0) continue;

      const dtId = Number(d?.documentTypeId);
      const sd = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
      if (sd !== DOCUMENT_STOCK_DIRECTION.OUT && sd !== DOCUMENT_STOCK_DIRECTION.IN) continue;

      if (!Boolean(d?.isClockedOut)) continue;
      if (isVoidedOrVoidDoc(d)) continue;

      const total = safeNumber(d?.total, 0);
      if (total <= 0) continue;

      const paidStatus = Number(d?.paidStatus ?? 0);
      if (paidStatus === 2) continue;

      const paidApprox = safeNumber(paymentSumsByDocId.get(documentId) ?? 0, 0);
      const pendingApprox = Math.max(0, total - paidApprox);
      if (pendingApprox <= 0) continue;

      const dueDate = d?.dueDate ? String(d.dueDate) : null;
      let daysOverdue = 0;
      if (dueDate) {
        const due = parseYmdToUtcMidnight(dueDate);
        const diffMs = now.getTime() - due.getTime();
        daysOverdue = diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
      }

      const number = String(d?.number ?? "").trim() || String(documentId);
      const date = String(d?.date ?? "").trim();

      if (sd === DOCUMENT_STOCK_DIRECTION.OUT) {
        const clientId = d?.clientId !== undefined && d?.clientId !== null ? Number(d.clientId) : null;
        const parsed = safeJsonParse(d?.internalNote);
        const derivedNameRaw =
          (typeof d?.clientNameSnapshot === "string" ? String(d.clientNameSnapshot).trim() : "") ||
          (typeof parsed?.customer?.name === "string" ? String(parsed.customer.name).trim() : "") ||
          "Anónimo";

        let email: string | null = null;
        if (clientId && Number.isFinite(clientId) && clientId > 0) {
          email = clientById.get(clientId)?.email ?? null;
        }
        if (!email) {
          const reminderEmail =
            typeof parsed?.payment?.reminderEmail === "string" ? String(parsed.payment.reminderEmail).trim() : "";
          if (reminderEmail) email = reminderEmail;
        }

        const partyKey = clientId && Number.isFinite(clientId) && clientId > 0 ? `client:${clientId}` : `clientname:${derivedNameRaw}`;
        const displayName =
          clientId && Number.isFinite(clientId) && clientId > 0
            ? clientById.get(clientId)?.name ?? derivedNameRaw
            : derivedNameRaw;

        if (!clientsAgg.has(partyKey)) {
          clientsAgg.set(partyKey, {
            partyKey,
            partyId: clientId && Number.isFinite(clientId) && clientId > 0 ? clientId : null,
            name: displayName,
            email,
            pendingApprox: 0,
            overdueApprox: 0,
            docs: [],
          });
        }

        const row = clientsAgg.get(partyKey)!;
        row.email = row.email || email;
        row.pendingApprox += pendingApprox;
        if (daysOverdue > 0) row.overdueApprox += pendingApprox;
        row.docs.push({
          documentId,
          number,
          date,
          dueDate,
          pendingApprox,
          daysOverdue,
          href: `/documents/${documentId}/pdf`,
        });
      }

      if (sd === DOCUMENT_STOCK_DIRECTION.IN) {
        const supplierId = d?.customerId !== undefined && d?.customerId !== null ? Number(d.customerId) : null;
        if (!supplierId || !Number.isFinite(supplierId) || supplierId <= 0) continue;

        const supplier = supplierById.get(supplierId);
        const partyKey = `supplier:${supplierId}`;

        if (!suppliersAgg.has(partyKey)) {
          suppliersAgg.set(partyKey, {
            partyKey,
            partyId: supplierId,
            name: supplier?.name ?? `#${supplierId}`,
            email: supplier?.email ?? null,
            pendingApprox: 0,
            overdueApprox: 0,
            docs: [],
          });
        }

        const row = suppliersAgg.get(partyKey)!;
        row.pendingApprox += pendingApprox;
        if (daysOverdue > 0) row.overdueApprox += pendingApprox;
        row.docs.push({
          documentId,
          number,
          date,
          dueDate,
          pendingApprox,
          daysOverdue,
          href: `/documents/${documentId}/pdf`,
        });
      }
    }

    const clients = Array.from(clientsAgg.values()).map((r) => ({ ...r, docs: topDocs(r.docs, 6) }));
    clients.sort((a, b) => {
      if (b.overdueApprox !== a.overdueApprox) return b.overdueApprox - a.overdueApprox;
      return b.pendingApprox - a.pendingApprox;
    });

    const suppliers = Array.from(suppliersAgg.values()).map((r) => ({ ...r, docs: topDocs(r.docs, 6) }));
    suppliers.sort((a, b) => {
      if (b.overdueApprox !== a.overdueApprox) return b.overdueApprox - a.overdueApprox;
      return b.pendingApprox - a.pendingApprox;
    });

    return {
      data: {
        clients,
        suppliers,
        generatedAt: new Date().toISOString(),
        window: { from, to },
      },
    };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
