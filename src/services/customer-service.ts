import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export async function listCustomers() {
  return listAllPages((args) => amplifyClient.models.Customer.list(args));
}

export async function createCustomer(customer: any) {
  return amplifyClient.models.Customer.create(customer);
}
