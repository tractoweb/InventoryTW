import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";

export default async function PaymentMethodsPage() {
  const res = await getCurrentSession();
  if (!res.data) redirect("/login?next=%2Fpayment-methods");
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  }
  redirect("/settings/payment-methods");
}
