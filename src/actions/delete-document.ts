'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { listAllPages } from '@/services/amplify-list-all';

const DeleteDocumentSchema = z.object({
  documentId: z.coerce.number().min(1),
});

export async function deleteDocumentAction(raw: z.infer<typeof DeleteDocumentSchema>): Promise<{ success: boolean; error?: string }> {
  noStore();

  const parsed = DeleteDocumentSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };

  try {
    const { documentId } = parsed.data;

    const docRes: any = await amplifyClient.models.Document.get({ documentId } as any);
    const doc = docRes?.data as any;
    if (!doc) return { success: false, error: 'Documento no encontrado' };

    if (Boolean(doc.isClockedOut)) {
      return { success: false, error: 'No se puede eliminar un documento finalizado (impacta stock/kardex).' };
    }

    // Delete payments
    const paymentsRes = await listAllPages<any>((args) => amplifyClient.models.Payment.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });
    if (!('error' in paymentsRes)) {
      for (const p of paymentsRes.data ?? []) {
        const paymentId = Number((p as any)?.paymentId);
        if (!Number.isFinite(paymentId)) continue;
        await amplifyClient.models.Payment.delete({ paymentId } as any);
      }
    }

    // Delete items + item taxes
    const itemsRes = await listAllPages<any>((args) => amplifyClient.models.DocumentItem.list(args), {
      filter: { documentId: { eq: Number(documentId) } },
    });

    if ('error' in itemsRes) {
      return { success: false, error: itemsRes.error };
    }

    for (const it of itemsRes.data ?? []) {
      const documentItemId = Number((it as any)?.documentItemId);
      if (!Number.isFinite(documentItemId)) continue;

      const taxesRes = await listAllPages<any>((args) => amplifyClient.models.DocumentItemTax.list(args), {
        filter: { documentItemId: { eq: Number(documentItemId) } },
      });

      if (!('error' in taxesRes)) {
        for (const t of taxesRes.data ?? []) {
          const taxId = Number((t as any)?.taxId);
          if (!Number.isFinite(taxId)) continue;
          await amplifyClient.models.DocumentItemTax.delete({ documentItemId, taxId } as any);
        }
      }

      await amplifyClient.models.DocumentItem.delete({ documentItemId } as any);
    }

    // Delete document
    await amplifyClient.models.Document.delete({ documentId } as any);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
