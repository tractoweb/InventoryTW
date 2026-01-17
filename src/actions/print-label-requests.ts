"use server";

import { unstable_noStore as noStore } from "next/cache";
import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export type CreatePrintLabelRequestItemInput = {
  productId: number;
  qty: number;
  name: string;
  reference: string | null;
  measurementUnit: string | null;
  productCreatedAt: string | null;
  primaryBarcode: string;
};

export type PrintLabelRequestDto = {
  requestId: string;
  requestedAt: string;
  status: string;
  items: Array<{
    productId: number;
    qty: number;
    name: string;
    reference: string | null;
    measurementUnit: string | null;
    productCreatedAt: string | null;
    primaryBarcode: string;
  }>;
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

function safeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function uuid(): string {
  // Node 18+ provides crypto.randomUUID.
  const c: any = globalThis as any;
  if (c.crypto && typeof c.crypto.randomUUID === "function") return c.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseIsoMs(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

async function deleteRequestCascade(requestIdRaw: string): Promise<void> {
  const requestId = String(requestIdRaw ?? "").trim();
  if (!requestId) return;

  const itemsRes = await listAllPages<any>((args) => amplifyClient.models.PrintLabelRequestItem.list(args), {
    filter: { requestId: { eq: requestId } },
  });

  const items = "error" in itemsRes ? [] : ((itemsRes.data ?? []) as any[]);
  await mapWithConcurrency(items, 10, async (it) => {
    const requestItemId = String(it?.requestItemId ?? "").trim();
    if (!requestItemId) return;
    await amplifyClient.models.PrintLabelRequestItem.delete({ requestItemId } as any);
  });

  await amplifyClient.models.PrintLabelRequest.delete({ requestId } as any);
}

export async function createPrintLabelRequest(items: CreatePrintLabelRequestItemInput[]): Promise<{
  data?: PrintLabelRequestDto;
  error?: string;
}> {
  noStore();

  try {
    const clean = (items ?? [])
      .map((it) => ({
        productId: safeInt(it?.productId, 0),
        qty: Math.max(1, safeInt(it?.qty, 1)),
        name: String(it?.name ?? "").trim(),
        reference: it?.reference ? String(it.reference) : null,
        measurementUnit: it?.measurementUnit ? String(it.measurementUnit) : null,
        productCreatedAt: it?.productCreatedAt ? String(it.productCreatedAt) : null,
        primaryBarcode: String(it?.primaryBarcode ?? "").trim(),
      }))
      .filter((it) => it.productId > 0 && it.qty > 0 && it.name.length > 0 && it.primaryBarcode.length > 0);

    if (clean.length === 0) return { error: "Solicitud vacía." };

    // Bound size for safety.
    if (clean.length > 200) return { error: "Demasiados productos en una sola solicitud (máx 200)." };

    const requestId = uuid();
    const requestedAt = new Date().toISOString();

    const createReq: any = await amplifyClient.models.PrintLabelRequest.create({
      requestId,
      requestedAt,
      status: "PENDING",
    } as any);

    const created = (createReq as any)?.data;
    if (!created) return { error: "No se pudo crear la solicitud." };

    await mapWithConcurrency(clean, 10, async (it) => {
      await amplifyClient.models.PrintLabelRequestItem.create({
        requestItemId: uuid(),
        requestId,
        productId: it.productId,
        qty: it.qty,
        name: it.name,
        reference: it.reference ?? undefined,
        measurementUnit: it.measurementUnit ?? undefined,
        productCreatedAt: it.productCreatedAt ?? undefined,
        primaryBarcode: it.primaryBarcode,
      } as any);
    });

    return {
      data: {
        requestId,
        requestedAt,
        status: "PENDING",
        items: clean,
      },
    };
  } catch (error) {
    return { error: formatAmplifyError(error) };
  }
}

export async function listPendingPrintLabelRequests(): Promise<{
  data: PrintLabelRequestDto[];
  error?: string;
}> {
  noStore();

  try {
    const reqRes = await listAllPages<any>((args) => amplifyClient.models.PrintLabelRequest.list(args), {
      filter: { status: { eq: "PENDING" } },
    });

    if ("error" in reqRes) return { data: [], error: reqRes.error };

    const reqsAll = (reqRes.data ?? []) as any[];

    // Auto-purge: delete PENDING requests older than 3 hours to save resources.
    const nowMs = Date.now();
    const cutoffMs = nowMs - 3 * 60 * 60 * 1000;

    const stale: any[] = [];
    const fresh: any[] = [];
    for (const r of reqsAll) {
      const requestedAtRaw = r?.requestedAt ?? r?.createdAt;
      const requestedMs = parseIsoMs(requestedAtRaw);
      if (requestedMs !== null && requestedMs < cutoffMs) stale.push(r);
      else fresh.push(r);
    }

    if (stale.length > 0) {
      await mapWithConcurrency(stale, 4, async (r) => {
        const requestId = String(r?.requestId ?? "").trim();
        if (!requestId) return;
        try {
          await deleteRequestCascade(requestId);
        } catch {
          // best-effort purge
        }
      });
    }

    const dtos = await mapWithConcurrency(fresh, 8, async (r) => {
      const requestId = String(r?.requestId ?? "");
      const requestedAt = String(r?.requestedAt ?? r?.createdAt ?? new Date().toISOString());
      const status = String(r?.status ?? "PENDING");

      const itemsRes = await listAllPages<any>((args) => amplifyClient.models.PrintLabelRequestItem.list(args), {
        filter: { requestId: { eq: requestId } },
      });

      const itemsRaw = "error" in itemsRes ? [] : (itemsRes.data ?? []);
      const items = (itemsRaw as any[])
        .map((it) => ({
          productId: safeInt(it?.productId, 0),
          qty: Math.max(1, safeInt(it?.qty, 1)),
          name: String(it?.name ?? ""),
          reference: it?.reference ? String(it.reference) : null,
          measurementUnit: it?.measurementUnit ? String(it.measurementUnit) : null,
          productCreatedAt: it?.productCreatedAt ? String(it.productCreatedAt) : null,
          primaryBarcode: String(it?.primaryBarcode ?? ""),
        }))
        .filter((it) => it.productId > 0 && it.qty > 0);

      return {
        requestId,
        requestedAt,
        status,
        items,
      } satisfies PrintLabelRequestDto;
    });

    dtos.sort((a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt)));

    return { data: dtos };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}

export async function deletePrintLabelRequests(args: {
  requestIds: string[];
}): Promise<{ ok: boolean; deleted: number; error?: string }> {
  noStore();

  try {
    const ids = Array.from(
      new Set(
        (args?.requestIds ?? [])
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) return { ok: true, deleted: 0 };

    await mapWithConcurrency(ids, 4, async (id) => {
      await deleteRequestCascade(id);
    });

    return { ok: true, deleted: ids.length };
  } catch (error) {
    return { ok: false, deleted: 0, error: formatAmplifyError(error) };
  }
}

export async function setPrintLabelRequestStatus(args: {
  requestId: string;
  status: "PENDING" | "PRINTED" | "CANCELED";
}): Promise<{ ok: boolean; error?: string }> {
  noStore();

  try {
    const requestId = String(args?.requestId ?? "").trim();
    const status = String(args?.status ?? "").trim() as any;

    if (!requestId) return { ok: false, error: "requestId requerido" };

    await amplifyClient.models.PrintLabelRequest.update({ requestId, status } as any);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatAmplifyError(error) };
  }
}
