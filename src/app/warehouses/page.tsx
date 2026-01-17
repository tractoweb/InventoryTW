import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";
import WarehousesClientPage from "@/components/warehouses/warehouses-client-page";

export default async function WarehousesPage() {
  const res = await getCurrentSession();
  if (!res.data) redirect("/login?next=%2Fwarehouses");
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  }
  return <WarehousesClientPage />;
}
