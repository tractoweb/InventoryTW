import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import PaymentMethodsClientPage from "@/components/payment-methods/payment-methods-client-page";

export default async function PaymentMethodsPage() {
  await requireSession(ACCESS_LEVELS.ADMIN);
  return <PaymentMethodsClientPage />;
}
