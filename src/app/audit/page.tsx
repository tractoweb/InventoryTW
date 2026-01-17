import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";
import AuditClientPage from "./audit-client-page";

export default async function AuditPage() {
  const res = await getCurrentSession();
  if (!res.data) redirect("/login?next=%2Faudit");
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  }
  return <AuditClientPage />;
}
