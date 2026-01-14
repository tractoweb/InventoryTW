'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

import { formatAmplifyError } from '@/lib/amplify-config';
import { allocateCounterRange } from '@/lib/allocate-counter-range';
import { createCustomer } from '@/services/customer-service';

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  taxNumber: z.string().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  countryId: z.coerce.number().optional(),
  isSupplier: z.boolean().default(true),
  isCustomer: z.boolean().default(false),
});

export type CreateCustomerInput = z.input<typeof CreateCustomerSchema>;

export async function createCustomerAction(raw: CreateCustomerInput): Promise<{ success: boolean; idCustomer?: number; error?: string }> {
  noStore();
  try {
    const parsed = CreateCustomerSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: 'Datos inválidos' };

    const [idCustomer] = await allocateCounterRange('customerId', 1);

    const input = parsed.data;
    await createCustomer({
      idCustomer,
      name: input.name,
      code: input.code,
      taxNumber: input.taxNumber,
      email: input.email,
      phoneNumber: input.phoneNumber,
      address: input.address,
      city: input.city,
      countryId: input.countryId,
      isEnabled: true,
      isSupplier: input.isSupplier,
      isCustomer: input.isCustomer,
    } as any);

    return { success: true, idCustomer };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
