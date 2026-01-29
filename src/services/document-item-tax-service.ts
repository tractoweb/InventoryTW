import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export async function listDocumentItemTaxes() {
  return listAllPages(amplifyClient.models.DocumentItemTax.list);
}

export async function createDocumentItemTax(documentItemTax: any) {
  return amplifyClient.models.DocumentItemTax.create(documentItemTax);
}
