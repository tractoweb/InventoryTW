import { amplifyClient } from "@/lib/amplify-server";

export async function listProductTaxes() {
  return amplifyClient.models.ProductTax.list();
}

export async function createProductTax(productTax: any) {
  return amplifyClient.models.ProductTax.create(productTax);
}
