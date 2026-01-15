import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import CompanyClientPage from "@/components/company/company-client-page";

export default async function CompanyPage() {
  await requireSession(ACCESS_LEVELS.ADMIN);
  return <CompanyClientPage />;
}
