'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { createDocument } from '@/services/document-service';

const DocumentItemInputSchema = z.object({
  productId: z.coerce.number().min(1),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().min(0),
});

const CreateDocumentInputSchema = z.object({
  userId: z.coerce.number().min(1).default(1),
  customerId: z.coerce.number().optional(),
  warehouseId: z.coerce.number().min(1),
  documentTypeId: z.coerce.number().min(1),
  date: z.string().min(1), // YYYY-MM-DD
  referenceDocumentNumber: z.string().optional(),
  note: z.string().optional(),
  internalNote: z.string().optional(),
  orderNumber: z.string().optional(),
  items: z.array(DocumentItemInputSchema).min(1),
});

async function allocateCounterRange(counterName: string, count: number): Promise<number[]> {
  const { data: existing } = await amplifyClient.models.Counter.get({ name: counterName });
  const current = existing ? Number((existing as any).value ?? 0) : 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const nextValue = safeCurrent + count;

  if (!existing) {
    await amplifyClient.models.Counter.create({ name: counterName, value: nextValue });
  } else {
    await amplifyClient.models.Counter.update({ name: counterName, value: nextValue });
  }

  // Return (safeCurrent+1 .. safeCurrent+count)
  return Array.from({ length: count }, (_, idx) => safeCurrent + idx + 1);
}

export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>;

export async function createDocumentAction(raw: CreateDocumentInput): Promise<{ success: boolean; documentId?: number; documentNumber?: string; error?: string }> {
  noStore();

  try {
    const parsed = CreateDocumentInputSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: 'Datos inválidos' };
    }

    const input = parsed.data;

    // Allocate IDs
    const [documentId] = await allocateCounterRange('documentId', 1);
    const itemIds = await allocateCounterRange('documentItemId', input.items.length);

    const date = new Date(`${input.date}T00:00:00`);

    const result = await createDocument({
      documentId,
      userId: input.userId,
      customerId: input.customerId,
      orderNumber: input.orderNumber,
      documentTypeId: input.documentTypeId,
      warehouseId: input.warehouseId,
      date,
      referenceDocumentNumber: input.referenceDocumentNumber,
      note: input.note,
      internalNote: input.internalNote,
      items: input.items.map((it, idx) => ({
        documentItemId: itemIds[idx],
        productId: it.productId,
        quantity: it.quantity,
        price: it.price,
      })),
    } as any);

    if (!result.success) {
      return { success: false, error: result.error || 'No se pudo crear el documento' };
    }

    return {
      success: true,
      documentId,
      documentNumber: result.documentNumber,
    };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
