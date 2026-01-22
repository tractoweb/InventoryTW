"use server";

import { unstable_cache } from "next/cache";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { listAllPages } from "@/services/amplify-list-all";

export type ClientListItem = {
  idClient: number;
  name: string;
  taxNumber?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  isEnabled?: boolean | null;
};

export async function getClients(args?: { onlyEnabled?: boolean }) {
  try {
    const onlyEnabled = Boolean(args?.onlyEnabled);

    const keyParts = ["clients", "list", onlyEnabled ? "enabled" : "all"];
    const cached = unstable_cache(
      async () => {
        const result = await listAllPages<ClientListItem>((listArgs) => amplifyClient.models.Client.list(listArgs));
        if ("error" in result) return { data: [], error: result.error };

        let normalized: ClientListItem[] = (result.data ?? [])
          .map((c: any) => ({
            idClient: Number(c?.idClient),
            name: String(c?.name ?? ""),
            taxNumber: c?.taxNumber ?? null,
            phoneNumber: c?.phoneNumber ?? null,
            email: c?.email ?? null,
            isEnabled: c?.isEnabled ?? null,
          }))
          .filter((c) => Number.isFinite(c.idClient) && c.idClient > 0 && c.name.length > 0);

        if (onlyEnabled) normalized = normalized.filter((c) => c?.isEnabled !== false);

        normalized.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        return { data: normalized } as const;
      },
      keyParts,
      { revalidate: 60, tags: [CACHE_TAGS.heavy.clients] }
    );

    return await cached();
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
