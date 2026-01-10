import { amplifyClient } from "@/lib/amplify-config";

export async function listCustomers() {
  return amplifyClient.models.Customer.list();
}

export async function createCustomer(customer: any) {
  return amplifyClient.models.Customer.create(customer);
}
