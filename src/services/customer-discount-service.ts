import { amplifyClient } from "@/lib/amplify-config";

export async function listCustomerDiscounts() {
  return amplifyClient.models.CustomerDiscount.list();
}

export async function createCustomerDiscount(customerDiscount: any) {
  return amplifyClient.models.CustomerDiscount.create(customerDiscount);
}
