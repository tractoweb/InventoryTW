import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export async function listDocumentItemPriceViews() {
  return listAllPages(amplifyClient.models.DocumentItemPriceView.list);
}

export async function createDocumentItemPriceView(documentItemPriceView: any) {
  return amplifyClient.models.DocumentItemPriceView.create(documentItemPriceView);
}
