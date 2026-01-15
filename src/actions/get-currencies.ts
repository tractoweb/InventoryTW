"use server";

import { unstable_noStore as noStore } from "next/cache";

import { formatAmplifyError } from "@/lib/amplify-config";
import { listCurrencies } from "@/services/currency-service";

export type CurrencyListItem = {
  idCurrency: number;
  name: string;
  code?: string | null;
};

export async function getCurrencies(): Promise<{ data?: CurrencyListItem[]; error?: string }> {
  noStore();
  try {
    const currencies = await listCurrencies();
    const data: CurrencyListItem[] = (currencies ?? [])
      .map((c: any) => ({
        idCurrency: Number(c?.idCurrency),
        name: String(c?.name ?? ""),
        code: c?.code ?? null,
      }))
      .filter((c) => Number.isFinite(c.idCurrency) && c.idCurrency > 0 && c.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { data };
  } catch (e) {
    return { error: formatAmplifyError(e) || "No se pudieron cargar las monedas." };
  }
}
