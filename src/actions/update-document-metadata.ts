'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { formatAmplifyError } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';
import { getCurrentSession } from '@/lib/session';
import { writeAuditLog } from '@/services/audit-log-service';

const UpdateDocumentMetadataSchema = z.object({
  documentId: z.coerce.number().min(1),
  note: z.string().optional(),
  clientName: z.string().optional(),
  clientId: z.coerce.number().optional(),
  customerId: z.coerce.number().optional(),
});

export type UpdateDocumentMetadataInput = z.input<typeof UpdateDocumentMetadataSchema>;

export async function updateDocumentMetadataAction(
  raw: UpdateDocumentMetadataInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = UpdateDocumentMetadataSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };

  try {
    const { documentId } = parsed.data;

    const docRes: any = await amplifyClient.models.Document.get({ documentId: Number(documentId) } as any);
    const doc = docRes?.data as any;
    if (!doc) return { success: false, error: 'Documento no encontrado' };

    if (Boolean(doc.isClockedOut)) {
      return { success: false, error: 'No se puede modificar un documento finalizado (impacta stock/kardex).' };
    }

    const note = parsed.data.note !== undefined ? String(parsed.data.note ?? '').trim() : undefined;

    const clientNameRaw = parsed.data.clientName !== undefined ? String(parsed.data.clientName ?? '').trim() : undefined;
    const clientNameSnapshot = clientNameRaw !== undefined ? (clientNameRaw || 'Anónimo') : undefined;

    const clientId =
      parsed.data.clientId !== undefined && Number.isFinite(Number(parsed.data.clientId)) && Number(parsed.data.clientId) > 0
        ? Number(parsed.data.clientId)
        : undefined;

    const customerId =
      parsed.data.customerId !== undefined && Number.isFinite(Number(parsed.data.customerId)) && Number(parsed.data.customerId) > 0
        ? Number(parsed.data.customerId)
        : undefined;

    const patch: any = { documentId: Number(documentId) };
    if (note !== undefined) patch.note = note || null;
    if (clientNameSnapshot !== undefined) patch.clientNameSnapshot = clientNameSnapshot;
    if (clientId !== undefined) patch.clientId = clientId;
    if (customerId !== undefined) patch.customerId = customerId;

    // If nothing to update, treat as success.
    const keys = Object.keys(patch);
    if (keys.length <= 1) return { success: true };

    // Best-effort backward compatibility: retry without newer fields if backend doesn't know them.
    const tryUpdate = async (p: any) => {
      return await amplifyClient.models.Document.update(p);
    };

    let updateRes: any;
    try {
      updateRes = await tryUpdate(patch);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (/Unknown field|Unknown argument|Field .* is not defined|Cannot query field/i.test(msg)) {
        const fallback: any = { documentId: Number(documentId) };
        if (note !== undefined) fallback.note = note || null;
        // Drop clientId/clientNameSnapshot/customerId fields for older schemas.
        updateRes = await tryUpdate(fallback);
      } else {
        throw e;
      }
    }

    if ((updateRes as any)?.errors?.length) {
      return { success: false, error: String((updateRes as any)?.errors?.[0]?.message ?? 'No se pudo actualizar') };
    }

    const sessionRes = await getCurrentSession();
    if (sessionRes.data?.userId) {
      writeAuditLog({
        userId: sessionRes.data.userId,
        action: 'UPDATE',
        tableName: 'Document',
        recordId: Number(documentId),
        oldValues: {
          note: doc.note ?? null,
          clientId: doc.clientId ?? null,
          clientNameSnapshot: doc.clientNameSnapshot ?? null,
          customerId: doc.customerId ?? null,
        },
        newValues: {
          note: note !== undefined ? (note || null) : doc.note ?? null,
          clientId: clientId !== undefined ? clientId : doc.clientId ?? null,
          clientNameSnapshot: clientNameSnapshot !== undefined ? clientNameSnapshot : doc.clientNameSnapshot ?? null,
          customerId: customerId !== undefined ? customerId : doc.customerId ?? null,
        },
      }).catch(() => {});
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
