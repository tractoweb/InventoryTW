import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import AuditClientPage from "./audit-client-page";

export default async function AuditPage() {
  await requireSession(ACCESS_LEVELS.ADMIN);
  return <AuditClientPage />;
}
