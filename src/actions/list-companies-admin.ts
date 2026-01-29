"use server";

import { unstable_noStore as noStore } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { requireSession } from "@/lib/session";
import { listAllPages } from "@/services/amplify-list-all";

export type CompanyAdminRow = {
  idCompany: number;
  name: string;
  taxNumber: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  countryId: number | null;
  bankAccountNumber: string | null;
  bankDetails: string | null;
  logo: string | null;
};

export async function listCompaniesAdminAction(): Promise<{ data: CompanyAdminRow[]; error?: string }> {
  noStore();
  await requireSession(ACCESS_LEVELS.ADMIN);

  try {
    const res = await listAllPages<any>((args) => amplifyClient.models.Company.list(args));
    if ("error" in res) return { data: [], error: res.error };

    const rows: CompanyAdminRow[] = (res.data ?? []).map((c: any) => ({
      idCompany: Number(c?.idCompany ?? 0),
      name: String(c?.name ?? ""),
      taxNumber: c?.taxNumber ? String(c.taxNumber) : null,
      email: c?.email ? String(c.email) : null,
      phoneNumber: c?.phoneNumber ? String(c.phoneNumber) : null,
      address: c?.address ? String(c.address) : null,
      postalCode: c?.postalCode ? String(c.postalCode) : null,
      city: c?.city ? String(c.city) : null,
      countryId: c?.countryId !== undefined && c?.countryId !== null ? Number(c.countryId) : null,
      bankAccountNumber: c?.bankAccountNumber ? String(c.bankAccountNumber) : null,
      bankDetails: c?.bankDetails ? String(c.bankDetails) : null,
      logo: c?.logo ? String(c.logo) : null,
    }));

    rows.sort((a, b) => a.idCompany - b.idCompany);
    return { data: rows };
  } catch (e) {
    return { data: [], error: formatAmplifyError(e) };
  }
}
