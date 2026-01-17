'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';
import { revalidateTag, unstable_cache } from "next/cache";

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { createCustomer } from '@/services/customer-service';
import { listAllPages } from '@/services/amplify-list-all';
import { CACHE_TAGS } from '@/lib/cache-tags';

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  taxNumber: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryId: z.coerce.number().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  dueDatePeriod: z.coerce.number().int().min(0).optional(),
  isTaxExempt: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  isSupplier: z.boolean().default(true),
  isCustomer: z.boolean().default(false),
});

export type CreateCustomerInput = z.input<typeof CreateCustomerSchema>;

export async function createCustomerAction(raw: CreateCustomerInput): Promise<{ success: boolean; idCustomer?: number; error?: string }> {
  noStore();
  try {
    const parsed = CreateCustomerSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: 'Datos inválidos' };

    // Seed counter from existing data to avoid collisions after imports.
    // Cached briefly: creation is rare but listing all pages can be heavy.
    const maxIdCached = unstable_cache(
      async () => {
        const existingCustomers = await listAllPages((args) => amplifyClient.models.Customer.list(args));
        if ('error' in existingCustomers) throw new Error(existingCustomers.error);
        return existingCustomers.data.reduce((max, c: any) => {
          const id = Number(c?.idCustomer ?? 0);
          return Number.isFinite(id) ? Math.max(max, id) : max;
        }, 0);
      },
      ["partners", "max-id"],
      { revalidate: 5 * 60, tags: [CACHE_TAGS.heavy.customers] }
    );

    const maxExistingId = await maxIdCached();
    await ensureCounterAtLeast('customerId', maxExistingId);

    const input = parsed.data;

    // Allocate an ID that is actually free (counter can still be stale or races can happen).
    for (let attempt = 0; attempt < 50; attempt++) {
      const [idCustomer] = await allocateCounterRange('customerId', 1);
      const existing = await amplifyClient.models.Customer.get({ idCustomer });
      if ((existing as any)?.data) continue;

      const createRes: any = await createCustomer({
        idCustomer,
        name: input.name,
        code: input.code,
        taxNumber: input.taxNumber,
        email: input.email,
        phoneNumber: input.phoneNumber,
        address: input.address,
        postalCode: input.postalCode,
        city: input.city,
        countryId: input.countryId,
        isEnabled: input.isEnabled ?? true,
        isSupplier: input.isSupplier,
        isCustomer: input.isCustomer,
        dueDatePeriod: input.dueDatePeriod ?? 0,
        isTaxExempt: input.isTaxExempt ?? false,
      } as any);

      if (createRes?.data) {
        revalidateTag(CACHE_TAGS.heavy.customers);
        return { success: true, idCustomer };
      }

      const errMsg = (createRes?.errors?.[0]?.message as string | undefined) ?? 'No se pudo crear el proveedor';
      // If creation failed due to an ID collision/race, try again; otherwise fail fast.
      if (/exist|already|duplicate|conflict/i.test(errMsg)) continue;
      return { success: false, error: errMsg };
    }

    return { success: false, error: 'No se pudo asignar un ID libre para el proveedor' };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
