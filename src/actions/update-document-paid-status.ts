'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { formatAmplifyError } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';
import { requireSession } from '@/lib/session';
import { ACCESS_LEVELS } from '@/lib/amplify-config';
import { writeAuditLog } from '@/services/audit-log-service';

const UpdateDocumentPaidStatusSchema = z.object({
  documentId: z.coerce.number().min(1),
  paidStatus: z.coerce.number().int().min(0).max(2),
});

export type UpdateDocumentPaidStatusInput = z.input<typeof UpdateDocumentPaidStatusSchema>;

function safeParseJson(raw: unknown): any | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (!(s.startsWith('{') || s.startsWith('['))) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function inferVoidLinkMeta(doc: any): { isVoidDocument: boolean; hasReversalLink: boolean } {
  const note = String(doc?.note ?? '');
  const parsed = safeParseJson(doc?.internalNote);

  const isVoidDocument = parsed?.source === 'SYSTEM' && parsed?.kind === 'VOID';

  const reversalIdFromInternal = Number(parsed?.void?.reversalDocumentId ?? 0);
  const hasReversalFromInternal = Number.isFinite(reversalIdFromInternal) && reversalIdFromInternal > 0;

  const hasReversalFromNote = /ANULADO_ID\s*:\s*\d+/i.test(note);

  return {
    isVoidDocument,
    hasReversalLink: hasReversalFromInternal || hasReversalFromNote,
  };
}

export async function updateDocumentPaidStatusAction(
  raw: UpdateDocumentPaidStatusInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = UpdateDocumentPaidStatusSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };

  try {
    const session = await requireSession(ACCESS_LEVELS.CASHIER);

    const { documentId, paidStatus } = parsed.data;

    const docRes: any = await amplifyClient.models.Document.get({ documentId: Number(documentId) } as any);
    const doc = docRes?.data as any;
    if (!doc) return { success: false, error: 'Documento no encontrado' };

    const voidMeta = inferVoidLinkMeta(doc);
    if (voidMeta.isVoidDocument || voidMeta.hasReversalLink) {
      return { success: false, error: 'No se puede cambiar el pago de un documento anulado/anulador.' };
    }

    const current = Number(doc?.paidStatus ?? 0);
    const next = Number(paidStatus);
    if (current === next) return { success: true };

    const updateRes: any = await amplifyClient.models.Document.update({
      documentId: Number(documentId),
      paidStatus: next,
    } as any);

    if (updateRes?.errors?.length) {
      return { success: false, error: String(updateRes?.errors?.[0]?.message ?? 'No se pudo actualizar') };
    }

    writeAuditLog({
      userId: Number(session.userId),
      action: 'UPDATE',
      tableName: 'Document',
      recordId: Number(documentId),
      oldValues: { paidStatus: current },
      newValues: { paidStatus: next },
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
