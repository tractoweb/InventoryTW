import { amplifyClient } from "@/lib/amplify-config";

export async function listDocumentItemTaxes() {
  return amplifyClient.models.DocumentItemTax.list();
}

export async function createDocumentItemTax(documentItemTax: any) {
  return amplifyClient.models.DocumentItemTax.create(documentItemTax);
}
