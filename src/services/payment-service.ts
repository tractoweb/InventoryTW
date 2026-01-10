import { amplifyClient } from "@/lib/amplify-config";

export async function listPayments() {
  return amplifyClient.models.Payment.list();
}

export async function createPayment(payment: any) {
  return amplifyClient.models.Payment.create(payment);
}
