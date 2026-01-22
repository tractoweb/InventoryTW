"use server";

import "server-only";

import { z } from "zod";
import { unstable_noStore as noStore, revalidateTag } from "next/cache";

import { amplifyClient, ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";
import { allocateCounterRange, ensureCounterAtLeast } from "@/lib/allocate-counter-range";
import { createClient } from "@/services/client-service";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";

const InputSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().optional().nullable(),
  documentIds: z.array(z.coerce.number().int().min(1)).min(1).max(500),
});

export type CreateAndLinkClientFromCreditInput = z.input<typeof InputSchema>;

export async function createAndLinkClientFromCreditAction(
  raw: CreateAndLinkClientFromCreditInput
): Promise<{ success: boolean; idClient?: number; linkedDocs?: number; error?: string }> {
  noStore();

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);

    const { name } = parsed.data;
    const email = parsed.data.email ? String(parsed.data.email).trim() : "";
    const docIds = Array.from(new Set(parsed.data.documentIds.map((n) => Number(n))))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 500);

    if (!docIds.length) return { success: false, error: "No hay documentos para vincular" };

    // Ensure counter is ahead of current max id.
    const existing = await listAllPages<any>((args) => amplifyClient.models.Client.list(args));
    if ("error" in existing) return { success: false, error: existing.error };

    const maxExistingId = (existing.data ?? []).reduce((max, c: any) => {
      const id = Number(c?.idClient ?? 0);
      return Number.isFinite(id) ? Math.max(max, id) : max;
    }, 0);

    await ensureCounterAtLeast("clientId", maxExistingId);

    const [idClient] = await allocateCounterRange("clientId", 1);

    const createRes: any = await createClient({
      idClient,
      name,
      email: email || undefined,
      isEnabled: true,
    } as any);

    if (!createRes?.data && Array.isArray(createRes?.errors) && createRes.errors.length) {
      return { success: false, error: String(createRes.errors?.[0]?.message ?? "No se pudo crear el cliente") };
    }
    if (!createRes?.data) return { success: false, error: "No se pudo crear el cliente" };

    writeAuditLog({
      userId: session.userId,
      action: "CREATE",
      tableName: "Client",
      recordId: idClient,
      newValues: { idClient, name, email: email || null, isEnabled: true },
    }).catch(() => {});

    let linkedDocs = 0;

    for (const documentId of docIds) {
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

    revalidateTag(CACHE_TAGS.heavy.clients);

    return { success: true, idClient, linkedDocs };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
