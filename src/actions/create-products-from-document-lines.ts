'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { formatAmplifyError } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { listAllPages } from '@/services/amplify-list-all';

const CreateProductsFromDocumentLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        name: z.string().min(1),
        code: z.string().optional(),
        productGroupId: z.coerce.number().optional(),
        currencyId: z.coerce.number().optional(),
        measurementUnit: z.string().optional(),
        isService: z.boolean().optional(),
        isEnabled: z.boolean().optional(),
        isTaxInclusivePrice: z.boolean().optional(),
        cost: z.coerce.number().min(0),
        price: z.coerce.number().min(0),
        markup: z.coerce.number().min(0).optional(),
      })
    )
    .min(1),
});

export type CreateProductsFromDocumentLinesInput = z.input<typeof CreateProductsFromDocumentLinesSchema>;

export async function createProductsFromDocumentLinesAction(
  raw: CreateProductsFromDocumentLinesInput
): Promise<{ success: boolean; created?: Array<{ lineId: string; idProduct: number; created: boolean }>; error?: string }> {
  noStore();
  try {
    const parsed = CreateProductsFromDocumentLinesSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: 'Datos inválidos' };

    const input = parsed.data;

    // Seed the product counter ONLY if it doesn't exist yet.
    const counterRes = await amplifyClient.models.Counter.get({ name: 'productId' });
    if (!counterRes.data) {
      const existingProducts = await listAllPages((args) => amplifyClient.models.Product.list(args));
      if ('error' in existingProducts) {
        return { success: false, error: existingProducts.error };
      }
      const maxExistingId = existingProducts.data.reduce<number>((max, p: any) => {
        const id = Number(p?.idProduct ?? 0);
        return Number.isFinite(id) ? Math.max(max, id) : max;
      }, 0);
      await ensureCounterAtLeast('productId', maxExistingId);
    }

    const created: Array<{ lineId: string; idProduct: number; created: boolean }> = [];
    const idByCode = new Map<string, number>();

    for (const line of input.lines) {
      const safeName = String(line.name ?? '').trim();
      if (!safeName) return { success: false, error: 'Nombre de producto inválido' };

      const code = line.code ? String(line.code).trim() : '';
      if (code) {
        const cached = idByCode.get(code);
        if (cached) {
          created.push({ lineId: line.lineId, idProduct: cached, created: false });
          continue;
        }

        const existing: any = await amplifyClient.models.Product.list({
          filter: { code: { eq: code } },
          limit: 1,
        } as any);
        const found = Array.isArray(existing?.data) ? existing.data[0] : null;
        const existingId = found?.idProduct !== undefined && found?.idProduct !== null ? Number(found.idProduct) : NaN;
        if (Number.isFinite(existingId) && existingId > 0) {
          idByCode.set(code, existingId);
          created.push({ lineId: line.lineId, idProduct: existingId, created: false });
          continue;
        }
      }

      // Allocate an id and create the Product. If we hit an ID collision, retry.
      for (let attempt = 0; attempt < 50; attempt++) {
        const [idProduct] = await allocateCounterRange('productId', 1);

        const existing = await amplifyClient.models.Product.get({ idProduct } as any);
        if ((existing as any)?.data) continue;

        const createRes: any = await amplifyClient.models.Product.create({
          idProduct,
          name: safeName,
          code: code || undefined,
          cost: Number(line.cost ?? 0),
          price: Number(line.price ?? 0),
          markup: line.markup !== undefined ? Number(line.markup) : undefined,
          productGroupId: line.productGroupId !== undefined ? Number(line.productGroupId) : undefined,
          currencyId: line.currencyId !== undefined ? Number(line.currencyId) : undefined,
          measurementUnit: line.measurementUnit ? String(line.measurementUnit) : undefined,
          isEnabled: line.isEnabled ?? true,
          isService: line.isService ?? false,
          isTaxInclusivePrice: line.isTaxInclusivePrice ?? true,
        } as any);

        if (createRes?.data) {
          if (code) idByCode.set(code, idProduct);
          created.push({ lineId: line.lineId, idProduct, created: true });
          break;
        }

        const errMsg = (createRes?.errors?.[0]?.message as string | undefined) ?? 'No se pudo crear el producto';
        if (/exist|already|duplicate|conflict/i.test(errMsg)) continue;
        return { success: false, error: errMsg };
      }
    }

    if (created.length !== input.lines.length) {
      return { success: false, error: 'No se pudo crear uno o más productos (IDs sin asignar)' };
    }

    return { success: true, created };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
