import { amplifyClient } from "@/lib/amplify-server";

export async function listBarcodes() {
  return amplifyClient.models.Barcode.list();
}

export async function createBarcode(barcode: any) {
  return amplifyClient.models.Barcode.create(barcode);
}
