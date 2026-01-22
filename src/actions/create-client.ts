'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';
import { revalidateTag, unstable_cache } from 'next/cache';

import { amplifyClient, formatAmplifyError } from '@/lib/amplify-config';
import { allocateCounterRange, ensureCounterAtLeast } from '@/lib/allocate-counter-range';
import { createClient } from '@/services/client-service';
import { listAllPages } from '@/services/amplify-list-all';
import { getCurrentSession } from '@/lib/session';
import { writeAuditLog } from '@/services/audit-log-service';
import { CACHE_TAGS } from '@/lib/cache-tags';

const CreateClientSchema = z.object({
  name: z.string().min(1),
  taxNumber: z.string().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  isEnabled: z.boolean().optional(),
  notes: z.string().optional(),
});

export type CreateClientInput = z.input<typeof CreateClientSchema>;

export async function createClientAction(
  raw: CreateClientInput
): Promise<{ success: boolean; idClient?: number; error?: string }> {
  noStore();
  try {
    const parsed = CreateClientSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: 'Datos inválidos' };

    const maxIdCached = unstable_cache(
      async () => {
        const existing = await listAllPages((args) => amplifyClient.models.Client.list(args));
        if ('error' in existing) throw new Error(existing.error);
        return existing.data.reduce((max, c: any) => {
          const id = Number(c?.idClient ?? 0);
          return Number.isFinite(id) ? Math.max(max, id) : max;
        }, 0);
      },
      ['clients', 'max-id'],
      { revalidate: 5 * 60, tags: [CACHE_TAGS.heavy.clients] }
    );

    const maxExistingId = await maxIdCached();
    await ensureCounterAtLeast('clientId', maxExistingId);

    const input = parsed.data;

    for (let attempt = 0; attempt < 50; attempt++) {
      const [idClient] = await allocateCounterRange('clientId', 1);
      const existing = await amplifyClient.models.Client.get({ idClient } as any);
      if ((existing as any)?.data) continue;

      const createRes: any = await createClient({
        idClient,
        name: input.name,
        taxNumber: input.taxNumber,
        email: input.email,
        phoneNumber: input.phoneNumber,
        address: input.address,
        city: input.city,
        isEnabled: input.isEnabled ?? true,
        notes: input.notes,
      } as any);

      if (createRes?.data) {
        const sessionRes = await getCurrentSession();
        if (sessionRes.data?.userId) {
          writeAuditLog({
            userId: sessionRes.data.userId,
            action: 'CREATE',
            tableName: 'Client',
            recordId: idClient,
            newValues: {
              idClient,
              name: input.name,
              taxNumber: input.taxNumber ?? null,
              email: input.email ?? null,
              phoneNumber: input.phoneNumber ?? null,
              address: input.address ?? null,
              city: input.city ?? null,
              isEnabled: input.isEnabled ?? true,
              notes: input.notes ?? null,
            },
          }).catch(() => {});
        }

        revalidateTag(CACHE_TAGS.heavy.clients);
        return { success: true, idClient };
      }

      const errMsg = (createRes?.errors?.[0]?.message as string | undefined) ?? 'No se pudo crear el cliente';
      if (/exist|already|duplicate|conflict/i.test(errMsg)) continue;
      return { success: false, error: errMsg };
    }

    return { success: false, error: 'No se pudo asignar un ID libre para el cliente' };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
