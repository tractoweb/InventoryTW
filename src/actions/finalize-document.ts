'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { finalizeDocument } from '@/services/document-service';

const FinalizeDocumentSchema = z.object({
  documentId: z.coerce.number().min(1),
  userId: z.coerce.number().min(1).default(1),
});

export async function finalizeDocumentAction(raw: z.infer<typeof FinalizeDocumentSchema>) {
  noStore();

  const parsed = FinalizeDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos' };
  }

  const result = await finalizeDocument(parsed.data.documentId, String(parsed.data.userId));
  return result;
}
