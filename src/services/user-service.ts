import { amplifyClient } from "@/lib/amplify-server";

export async function listUsers() {
  return amplifyClient.models.User.list();
}

export async function createUser(user: any) {
  return amplifyClient.models.User.create(user);
}
