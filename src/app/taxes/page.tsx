import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import TaxesClientPage from "@/components/taxes/taxes-client-page";

export default async function TaxesPage() {
  await requireSession(ACCESS_LEVELS.ADMIN);
  return <TaxesClientPage />;
}
