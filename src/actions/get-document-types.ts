"use server";

import { unstable_noStore as noStore } from "next/cache";
import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export type DocumentTypeListItem = {
  documentTypeId: number;
  name: string;
  code?: string | null;
  warehouseId?: number | null;
  stockDirection?: number | null;
  isEnabled?: boolean | null;
};

export async function getDocumentTypes() {
  noStore();

  try {
    const result = await listAllPages<DocumentTypeListItem>((args) =>
      amplifyClient.models.DocumentType.list(args)
    );

    if ("error" in result) return { data: [], error: result.error };

    const data = (result.data ?? [])
      .map((d: any) => ({
        documentTypeId: Number(d?.documentTypeId),
        name: String(d?.name ?? ""),
        code: d?.code ?? null,
        warehouseId: d?.warehouseId ?? null,
        stockDirection: d?.stockDirection ?? null,
        isEnabled: d?.isEnabled ?? null,
      }))
      .filter((d: any) => Number.isFinite(d.documentTypeId) && d.documentTypeId > 0 && d.name.length > 0)
      .sort((a: any, b: any) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));

    return { data };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
