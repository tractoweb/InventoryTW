import { redirect } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";

import { PosSalesRegistryClientPage } from "./components/pos-sales-registry-client";

export default async function PosSalesRegistryPage() {
  const sessionRes = await getCurrentSession();
  if (!sessionRes.data) {
    redirect("/login?next=/pos/registro-ventas");
  }

  const accessLevel = Number(sessionRes.data.accessLevel ?? 0);
  if (accessLevel < ACCESS_LEVELS.CASHIER) {
    return <AccessDenied />;
  }

  return <PosSalesRegistryClientPage />;
}
