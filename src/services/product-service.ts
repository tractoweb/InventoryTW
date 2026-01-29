import { amplifyClient } from "@/lib/amplify-server";

export async function listProducts() {
  return amplifyClient.models.Product.list();
}

export async function createProduct(product: any) {
  return amplifyClient.models.Product.create(product);
}
