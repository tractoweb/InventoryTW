"use server";

import { formatAmplifyError } from "@/lib/amplify-config";
import { cached } from "@/lib/server-cache";
import { listCurrencies } from "@/services/currency-service";

export type CurrencyListItem = {
  idCurrency: number;
  name: string;
  code?: string | null;
};

export async function getCurrencies(): Promise<{ data?: CurrencyListItem[]; error?: string }> {
  try {
    const load = cached(
      async () => {
        const currencies = await listCurrencies();
        const data: CurrencyListItem[] = (currencies ?? [])
          .map((c: any) => ({
            idCurrency: Number(c?.idCurrency),
            name: String(c?.name ?? ""),
            code: c?.code ?? null,
          }))
          .filter((c) => Number.isFinite(c.idCurrency) && c.idCurrency > 0 && c.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        return { data } as const;
      },
      {
        keyParts: ["ref", "currencies"],
        revalidateSeconds: 24 * 60 * 60,
        tags: ["ref:currencies"],
      }
    );

    return await load();
  } catch (e) {
    return { error: formatAmplifyError(e) || "No se pudieron cargar las monedas." };
  }
}
