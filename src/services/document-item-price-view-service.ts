import { amplifyClient } from "@/lib/amplify-config";

export async function listDocumentItemPriceViews() {
  return amplifyClient.models.DocumentItemPriceView?.list();
}

export async function createDocumentItemPriceView(documentItemPriceView: any) {
  return amplifyClient.models.DocumentItemPriceView?.create(documentItemPriceView);
}
