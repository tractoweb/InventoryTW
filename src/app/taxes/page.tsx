import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";

export default async function TaxesPage() {
  const res = await getCurrentSession();
  if (!res.data) redirect("/login?next=%2Ftaxes");
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  }
  redirect("/settings/taxes");
}
