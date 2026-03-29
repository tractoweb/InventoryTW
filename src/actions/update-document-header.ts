'use server';

import { z } from 'zod';
import { revalidateTag, unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { getCurrentSession } from '@/lib/session';
import { writeAuditLog } from '@/services/audit-log-service';

const UpdateDocumentHeaderSchema = z.object({
  documentId: z.coerce.number().min(1),
  userId: z.coerce.number().min(1).optional(),
  warehouseId: z.coerce.number().min(1),
  documentTypeId: z.coerce.number().min(1),
  customerId: z.coerce.number().min(1).optional(),
  date: z.string().min(1),
  paidStatus: z.coerce.number().int().min(0).max(2),
  referenceDocumentNumber: z.string().optional(),
  note: z.string().optional(),
  internalNote: z.string().optional(),
});

export type UpdateDocumentHeaderInput = z.input<typeof UpdateDocumentHeaderSchema>;

export async function updateDocumentHeaderAction(
  raw: UpdateDocumentHeaderInput
): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = UpdateDocumentHeaderSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };

  try {
    const sessionRes = await getCurrentSession();
    const { documentId } = parsed.data;

    const docRes: any = await amplifyClient.models.Document.get({ documentId: Number(documentId) } as any);
    const doc = docRes?.data as any;
    if (!doc) return { success: false, error: 'Documento no encontrado' };

    const patch: any = {
      documentId: Number(documentId),
      userId: Number(parsed.data.userId ?? doc.userId ?? 1),
      warehouseId: Number(parsed.data.warehouseId),
      documentTypeId: Number(parsed.data.documentTypeId),
      customerId:
        parsed.data.customerId !== undefined && Number(parsed.data.customerId) > 0
          ? Number(parsed.data.customerId)
          : null,
      date: String(parsed.data.date),
      paidStatus: Number(parsed.data.paidStatus),
      referenceDocumentNumber: String(parsed.data.referenceDocumentNumber ?? '').trim() || null,
      note: String(parsed.data.note ?? '').trim() || null,
      internalNote: String(parsed.data.internalNote ?? '').trim() || null,
    };

    const updateRes: any = await amplifyClient.models.Document.update(patch);
    if (updateRes?.errors?.length) {
      return { success: false, error: String(updateRes?.errors?.[0]?.message ?? 'No se pudo actualizar') };
    }

    if (sessionRes.data?.userId) {
      writeAuditLog({
        userId: Number(sessionRes.data.userId),
        action: 'UPDATE',
        tableName: 'Document',
        recordId: Number(documentId),
        oldValues: {
          userId: doc.userId ?? null,
          warehouseId: doc.warehouseId ?? null,
          documentTypeId: doc.documentTypeId ?? null,
          customerId: doc.customerId ?? null,
          date: doc.date ?? null,
          paidStatus: doc.paidStatus ?? null,
          referenceDocumentNumber: doc.referenceDocumentNumber ?? null,
          note: doc.note ?? null,
        },
        newValues: {
          userId: patch.userId,
          warehouseId: patch.warehouseId,
          documentTypeId: patch.documentTypeId,
          customerId: patch.customerId,
          date: patch.date,
          paidStatus: patch.paidStatus,
          referenceDocumentNumber: patch.referenceDocumentNumber,
          note: patch.note,
        },
      }).catch(() => {});
    }

    revalidateTag(CACHE_TAGS.heavy.documents);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
