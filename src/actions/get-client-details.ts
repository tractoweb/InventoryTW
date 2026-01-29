"use server";

import { unstable_cache } from "next/cache";

import { formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type ClientDetails = {
  idClient: number;
  name: string;
  taxNumber?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  city?: string | null;
  isEnabled?: boolean | null;
  notes?: string | null;
};

export async function getClientDetails(clientId: number): Promise<{ data?: ClientDetails; error?: string }> {
  try {
    const idClient = Number(clientId);
    if (!Number.isFinite(idClient) || idClient <= 0) return { error: "ID de cliente inválido" };

    const keyParts = ["clients", "details", String(idClient)];
    const cached = unstable_cache(
      async () => {
        const res: any = await amplifyClient.models.Client.get({ idClient } as any);
        const c = res?.data as any;
        if (!c) return null;

        const data: ClientDetails = {
          idClient: Number(c.idClient),
          name: String(c.name ?? ""),
          taxNumber: c.taxNumber ?? null,
          email: c.email ?? null,
          phoneNumber: c.phoneNumber ?? null,
          address: c.address ?? null,
          city: c.city ?? null,
          isEnabled: c.isEnabled ?? null,
          notes: c.notes ?? null,
        };

        if (!Number.isFinite(data.idClient) || data.idClient <= 0 || !data.name) return null;
        return data;
      },
      keyParts,
      {
        revalidate: 5 * 60,
        tags: [CACHE_TAGS.heavy.clients],
      }
    );

    const data = await cached();
    if (!data) return { error: "Cliente no encontrado" };

    return { data };
  } catch (e) {
    return { error: formatAmplifyError(e) };
  }
}
