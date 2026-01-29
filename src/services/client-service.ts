import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export async function listClients() {
  return listAllPages((args) => amplifyClient.models.Client.list(args));
}

export async function createClient(client: any) {
  return amplifyClient.models.Client.create(client);
}

export async function updateClient(client: any) {
  return amplifyClient.models.Client.update(client);
}
