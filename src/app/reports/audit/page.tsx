import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";

import AuditClientPage from "@/app/audit/audit-client-page";

export default async function ReportsAuditPage() {
  const res = await getCurrentSession();
  if (!res.data) redirect("/login?next=%2Freports%2Faudit");
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/reports" backLabel="Volver a reportes" />;
  }
  return <AuditClientPage />;
}
