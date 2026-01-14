'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { createProduct } from '@/services/product-service';
import { listAllPages } from '@/services/amplify-list-all';

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

    // Seed counter from existing data to avoid collisions after imports.
    const existingProducts = await listAllPages((args) => amplifyClient.models.Product.list(args));
    if ('error' in existingProducts) {
      return { success: false, error: existingProducts.error };
    }
    const maxExistingId = existingProducts.data.reduce((max, p: any) => {
      const id = Number(p?.idProduct ?? 0);
      return Number.isFinite(id) ? Math.max(max, id) : max;
    }, 0);
    await ensureCounterAtLeast('productId', maxExistingId);

    const input = parsed.data;

    for (let attempt = 0; attempt < 50; attempt++) {
      const [idProduct] = await allocateCounterRange('productId', 1);
      const existing = await amplifyClient.models.Product.get({ idProduct });
      if ((existing as any)?.data) continue;

      const createRes: any = await createProduct({
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

      if (createRes?.data) return { success: true, idProduct };

      const errMsg = (createRes?.errors?.[0]?.message as string | undefined) ?? 'No se pudo crear el producto';
      if (/exist|already|duplicate|conflict/i.test(errMsg)) continue;
      return { success: false, error: errMsg };
    }

    return { success: false, error: 'No se pudo asignar un ID libre para el producto' };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
