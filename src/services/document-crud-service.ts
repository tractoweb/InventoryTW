import { amplifyClient } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export async function listDocuments() {
  return listAllPages(amplifyClient.models.Document.list);
}

export async function createDocument(document: any) {
  return amplifyClient.models.Document.create(document);
}
