import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import WarehousesClientPage from "@/components/warehouses/warehouses-client-page";

export default async function WarehousesPage() {
  await requireSession(ACCESS_LEVELS.ADMIN);
  return <WarehousesClientPage />;
}
