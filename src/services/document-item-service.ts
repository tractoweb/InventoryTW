import { amplifyClient } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export async function listDocumentItems() {
  return listAllPages(amplifyClient.models.DocumentItem.list);
}

export async function createDocumentItem(documentItem: any) {
  return amplifyClient.models.DocumentItem.create(documentItem);
}
