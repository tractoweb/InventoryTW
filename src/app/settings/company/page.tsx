import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { AccessDenied } from "@/components/auth/access-denied";

import CompanyClientPage from "@/components/company/company-client-page";

export default async function SettingsCompanyPage() {
  const res = await getCurrentSession();
  if (!res.data) return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/settings" backLabel="Volver a configuración" />;
  }
  return <CompanyClientPage />;
}
