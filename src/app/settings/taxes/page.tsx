import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { AccessDenied } from "@/components/auth/access-denied";

import TaxesClientPage from "@/components/taxes/taxes-client-page";

export default async function SettingsTaxesPage() {
  const res = await getCurrentSession();
  if (!res.data) return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/settings" backLabel="Volver a configuración" />;
  }
  return <TaxesClientPage />;
}
