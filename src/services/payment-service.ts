import { amplifyClient } from "@/lib/amplify-server";
import { listAllPages } from "@/services/amplify-list-all";

export async function listPayments() {
  return listAllPages(amplifyClient.models.Payment.list);
}

export async function createPayment(payment: any) {
  return amplifyClient.models.Payment.create(payment);
}
