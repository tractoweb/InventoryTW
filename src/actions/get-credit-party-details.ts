"use server";

import { unstable_noStore as noStore } from "next/cache";

import { DOCUMENT_STOCK_DIRECTION, formatAmplifyError, normalizeStockDirection } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
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
  isFinalized: boolean;
};

export type CreditPartyDetails = {
  partyKey: string;
  name: string;
  email?: string | null;
  pendingApprox: number;
  overdueApprox: number;
  docs: CreditDocRow[];
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

function deriveClientName(doc: any): string {
  const clientNameSnapshot = typeof doc?.clientNameSnapshot === "string" ? String(doc.clientNameSnapshot).trim() : "";
  if (clientNameSnapshot) return clientNameSnapshot;
  const parsed = safeJsonParse(doc?.internalNote);
  const name = parsed?.customer?.name;
  if (typeof name === "string" && name.trim().length > 0) return name.trim();
  return "Anónimo";
}

export async function getCreditPartyDetailsAction(input: {
  kind: "client" | "supplier";
  partyKey: string;
  daysWindow?: number;
}): Promise<{ data?: CreditPartyDetails; error?: string }> {
  noStore();

  try {
    await requireSession();

    const kind = input.kind;
    const partyKey = String(input.partyKey ?? "").trim();
    if (!partyKey) return { error: "partyKey requerido" };

    const to = ymdToday();
    const from = addDaysYmd(to, -Math.max(30, Math.min(3650, Number(input.daysWindow) || 365)));

    const [docTypesRes, docsRes, paymentsRes, clientsRes, customersRes] = await Promise.all([
      listAllPages<any>((a) => amplifyClient.models.DocumentType.list(a)),
      listAllPages<any>((a) =>
        amplifyClient.models.Document.list({
          ...(a ?? {}),
          filter: { date: { ge: from, le: to } },
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
    const categoryByDocTypeId = new Map<number, number>();
    for (const dt of docTypesRes.data ?? []) {
      const id = Number((dt as any)?.documentTypeId);
      const sd = normalizeStockDirection((dt as any)?.stockDirection);
      const categoryId = Number((dt as any)?.documentCategoryId ?? 0) || 0;
      if (Number.isFinite(id) && id > 0) {
        stockDirectionByDocTypeId.set(id, sd);
        categoryByDocTypeId.set(id, categoryId);
      }
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

    // partyKey format: client:<id> | clientname:<name> | supplier:<id>
    let clientId: number | null = null;
    let clientNameKey: string | null = null;
    let supplierId: number | null = null;

    if (kind === "client") {
      if (partyKey.startsWith("client:")) {
        const id = Number(partyKey.slice("client:".length));
        if (Number.isFinite(id) && id > 0) clientId = id;
      } else if (partyKey.startsWith("clientname:")) {
        clientNameKey = partyKey.slice("clientname:".length).trim();
      }
      if (!clientId && !clientNameKey) return { error: "partyKey inválido para client" };
    }

    if (kind === "supplier") {
      if (partyKey.startsWith("supplier:")) {
        const id = Number(partyKey.slice("supplier:".length));
        if (Number.isFinite(id) && id > 0) supplierId = id;
      }
      if (!supplierId) return { error: "partyKey inválido para supplier" };
    }

    const now = new Date();

    let name = kind === "client" ? (clientId ? clientById.get(clientId)?.name ?? `#${clientId}` : clientNameKey || "Anónimo") : supplierById.get(supplierId!)?.name ?? `#${supplierId}`;
    let email: string | null | undefined = kind === "client" ? (clientId ? clientById.get(clientId)?.email ?? null : null) : supplierById.get(supplierId!)?.email ?? null;

    let pendingApproxTotal = 0;
    let overdueApproxTotal = 0;
    const docs: CreditDocRow[] = [];

    for (const d of docsRes.data ?? []) {
      const documentId = Number(d?.documentId);
      if (!Number.isFinite(documentId) || documentId <= 0) continue;

      const dtId = Number(d?.documentTypeId);
      const sd = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
      const categoryId = categoryByDocTypeId.get(dtId) ?? 0;

      // Client receivables: keep strict (sales-like)
      if (kind === "client" && sd !== DOCUMENT_STOCK_DIRECTION.OUT && categoryId !== 2) continue;

      // Supplier payables: include supplier-linked purchase docs even if stockDirection/category is inconsistent
      if (kind === "supplier") {
        const dSupplierId = d?.customerId !== undefined && d?.customerId !== null ? Number(d.customerId) : null;
        if (!dSupplierId || !Number.isFinite(dSupplierId) || dSupplierId !== supplierId) continue;
      }

      const isFinalized = Boolean(d?.isClockedOut);

      // For clients: count only finalized documents.
      // For suppliers: allow both finalized and non-finalized, to avoid missing payables.
      if (kind === "client" && !isFinalized) continue;
      if (isVoidedOrVoidDoc(d)) continue;

      const total = safeNumber(d?.total, 0);
      if (total <= 0) continue;

      const paidStatus = Number(d?.paidStatus ?? 0);
      if (paidStatus === 2) continue;

      // Party match
      if (kind === "client") {
        const dClientId = d?.clientId !== undefined && d?.clientId !== null ? Number(d.clientId) : null;
        if (clientId) {
          if (!dClientId || !Number.isFinite(dClientId) || dClientId !== clientId) continue;
        } else {
          const derived = deriveClientName(d);
          if (derived !== clientNameKey) continue;
        }

        // Best-effort email from POS reminderEmail
        if (!email) {
          const parsed = safeJsonParse(d?.internalNote);
          const reminderEmail = typeof parsed?.payment?.reminderEmail === "string" ? String(parsed.payment.reminderEmail).trim() : "";
          if (reminderEmail) email = reminderEmail;
        }
      }

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

      pendingApproxTotal += pendingApprox;
      if (daysOverdue > 0) overdueApproxTotal += pendingApprox;

      docs.push({
        documentId,
        number,
        date,
        dueDate,
        pendingApprox,
        daysOverdue,
        href: `/documents/${documentId}/pdf`,
        isFinalized,
      });
    }

    // Stable ordering: most overdue first, then largest pending, then newest date.
    docs.sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      if (b.pendingApprox !== a.pendingApprox) return b.pendingApprox - a.pendingApprox;
      return String(b.date).localeCompare(String(a.date));
    });

    // Update display name if we have id.
    if (kind === "client" && clientId) {
      name = clientById.get(clientId)?.name ?? name;
      email = clientById.get(clientId)?.email ?? email;
    }
    if (kind === "supplier" && supplierId) {
      name = supplierById.get(supplierId)?.name ?? name;
      email = supplierById.get(supplierId)?.email ?? email;
    }

    return {
      data: {
        partyKey,
        name,
        email: email ?? null,
        pendingApprox: pendingApproxTotal,
        overdueApprox: overdueApproxTotal,
        docs,
      },
    };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
