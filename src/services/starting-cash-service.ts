import { amplifyClient } from "@/lib/amplify-config";

export async function listStartingCash() {
  return amplifyClient.models.StartingCash.list();
}

export async function createStartingCash(startingCash: any) {
  return amplifyClient.models.StartingCash.create(startingCash);
}
