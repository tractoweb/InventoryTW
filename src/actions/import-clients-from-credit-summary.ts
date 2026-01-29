"use server";

import "server-only";

import { z } from "zod";
import { unstable_noStore as noStore, revalidateTag } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";
import { allocateCounterRange, ensureCounterAtLeast } from "@/lib/allocate-counter-range";
import { createClient } from "@/services/client-service";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getCreditSummaryAction } from "@/actions/get-credit-summary";

const InputSchema = z.object({
  daysWindow: z.coerce.number().int().min(30).max(3650).optional(),
  maxClients: z.coerce.number().int().min(1).max(200).optional(),
});

export type ImportClientsFromCreditSummaryInput = z.input<typeof InputSchema>;

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export async function importClientsFromCreditSummaryAction(
  raw?: ImportClientsFromCreditSummaryInput
): Promise<{ success: boolean; created: number; linkedDocs: number; skipped: number; error?: string }> {
  noStore();

  const parsed = InputSchema.safeParse(raw ?? {});
  if (!parsed.success) return { success: false, created: 0, linkedDocs: 0, skipped: 0, error: "Datos inválidos" };

  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);

    const daysWindow = parsed.data.daysWindow ?? 365;
    const maxClients = parsed.data.maxClients ?? 50;

    const summary = await getCreditSummaryAction(daysWindow);
    if (summary.error || !summary.data) {
      return { success: false, created: 0, linkedDocs: 0, skipped: 0, error: summary.error ?? "No se pudo cargar cartera" };
    }

    const creditClients = summary.data.clients ?? [];
    if (!creditClients.length) {
      return { success: true, created: 0, linkedDocs: 0, skipped: 0 };
    }

    const existingRes = await listAllPages<any>((args) => amplifyClient.models.Client.list(args));
    if ("error" in existingRes) {
      return { success: false, created: 0, linkedDocs: 0, skipped: 0, error: existingRes.error };
    }

    const existingById = new Set<number>();
    const existingByNameEmail = new Set<string>();

    let maxExistingId = 0;
    for (const c of existingRes.data ?? []) {
      const id = Number((c as any)?.idClient ?? 0);
      if (Number.isFinite(id) && id > 0) {
        existingById.add(id);
        maxExistingId = Math.max(maxExistingId, id);
      }
      const name = normalizeKey((c as any)?.name);
      const email = normalizeKey((c as any)?.email);
      if (name) existingByNameEmail.add(`${name}|${email}`);
    }

    await ensureCounterAtLeast("clientId", maxExistingId);

    let created = 0;
    let linkedDocs = 0;
    let skipped = 0;

    const toProcess = creditClients.slice(0, Math.max(1, maxClients));

    for (const row of toProcess) {
      const partyKey = String((row as any)?.partyKey ?? "").trim();
      const name = String((row as any)?.name ?? "").trim();
      const email = (row as any)?.email ? String((row as any).email).trim() : "";

      if (!name) {
        skipped++;
        continue;
      }

      let idClient: number | null = null;

      // If docs already have clientId, ensure the Client row exists with that id.
      if (partyKey.startsWith("client:")) {
        const id = Number(partyKey.slice("client:".length));
        if (Number.isFinite(id) && id > 0) idClient = id;
      }

      // Dedup by (name,email) when partyKey is name-based.
      const dedupKey = `${normalizeKey(name)}|${normalizeKey(email)}`;

      if (idClient && existingById.has(idClient)) {
        skipped++;
        continue;
      }
      if (!idClient && existingByNameEmail.has(dedupKey)) {
        skipped++;
        continue;
      }

      if (!idClient) {
        const [allocated] = await allocateCounterRange("clientId", 1);
        idClient = Number(allocated);
      } else {
        // Keep counter ahead of any forced ids so future allocations don't collide.
        await ensureCounterAtLeast("clientId", idClient);
      }

      // Create client row if missing.
      if (!existingById.has(idClient)) {
        const createRes: any = await createClient({
          idClient,
          name,
          email: email || undefined,
          isEnabled: true,
        } as any);

        if (!createRes?.data && Array.isArray(createRes?.errors) && createRes.errors.length) {
          skipped++;
          continue;
        }

        existingById.add(idClient);
        existingByNameEmail.add(dedupKey);
        created++;

        writeAuditLog({
          userId: session.userId,
          action: "CREATE",
          tableName: "Client",
          recordId: idClient,
          newValues: {
            idClient,
            name,
            email: email || null,
            isEnabled: true,
          },
        }).catch(() => {});
      }

      // Link the (up to 6) docs included in the credit summary to the created client.
      for (const d of (row as any)?.docs ?? []) {
        const documentId = Number((d as any)?.documentId);
        if (!Number.isFinite(documentId) || documentId <= 0) continue;

        try {
          const docRes: any = await amplifyClient.models.Document.get({ documentId } as any);
          const doc = docRes?.data;
          if (!doc) continue;

          const currentClientId = doc?.clientId !== undefined && doc?.clientId !== null ? Number(doc.clientId) : null;
          if (currentClientId && Number.isFinite(currentClientId) && currentClientId > 0) continue;

          const upd: any = await amplifyClient.models.Document.update({
            documentId,
            clientId: idClient,
            clientNameSnapshot: doc?.clientNameSnapshot ? undefined : name,
          } as any);

          if (upd?.data) linkedDocs++;
        } catch {
          // best-effort
        }
      }
    }

    revalidateTag(CACHE_TAGS.heavy.clients);

    return { success: true, created, linkedDocs, skipped };
  } catch (e) {
    return { success: false, created: 0, linkedDocs: 0, skipped: 0, error: formatAmplifyError(e) };
  }
}
