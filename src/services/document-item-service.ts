import { amplifyClient } from "@/lib/amplify-config";

export async function listDocumentItems() {
  return amplifyClient.models.DocumentItem.list();
}

export async function createDocumentItem(documentItem: any) {
  return amplifyClient.models.DocumentItem.create(documentItem);
}
