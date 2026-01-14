'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { formatAmplifyError } from '@/lib/amplify-config';
import { allocateCounterRange } from '@/lib/allocate-counter-range';
import { createProduct } from '@/services/product-service';

const CreateProductSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  cost: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  productGroupId: z.coerce.number().optional(),
  isEnabled: z.boolean().default(true),
  isService: z.boolean().default(false),
  isTaxInclusivePrice: z.boolean().default(true),
});

export type CreateProductInput = z.input<typeof CreateProductSchema>;

export async function createProductAction(raw: CreateProductInput): Promise<{ success: boolean; idProduct?: number; error?: string }> {
  noStore();
  try {
    const parsed = CreateProductSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: 'Datos inválidos' };

    const [idProduct] = await allocateCounterRange('productId', 1);
    const input = parsed.data;

    await createProduct({
      idProduct,
      name: input.name,
      code: input.code,
      cost: input.cost ?? 0,
      price: input.price ?? 0,
      isEnabled: input.isEnabled,
      isService: input.isService,
      isTaxInclusivePrice: input.isTaxInclusivePrice,
      // keep other fields defaulted by schema
    } as any);

    return { success: true, idProduct };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
