import { amplifyClient } from "@/lib/amplify-config";

export async function listCounters() {
  return amplifyClient.models.Counter.list();
}

export async function createCounter(counter: any) {
  return amplifyClient.models.Counter.create(counter);
}
