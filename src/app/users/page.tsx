import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import UsersClientPage from "./users-client-page";

export default async function UsersPage() {
  await requireSession(ACCESS_LEVELS.ADMIN);
  return <UsersClientPage />;
}
