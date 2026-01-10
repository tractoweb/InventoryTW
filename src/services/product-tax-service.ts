import { amplifyClient } from "@/lib/amplify-config";

export async function listProductTaxes() {
  return amplifyClient.models.ProductTax.list();
}

export async function createProductTax(productTax: any) {
  return amplifyClient.models.ProductTax.create(productTax);
}
