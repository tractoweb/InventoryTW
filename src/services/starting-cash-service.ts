import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export async function listStartingCash() {
  return listAllPages(amplifyClient.models.StartingCash.list);
}

export async function createStartingCash(startingCash: any) {
  return amplifyClient.models.StartingCash.create(startingCash);
}
