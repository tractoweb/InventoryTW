import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";
import { AccessDenied } from "@/components/auth/access-denied";
import { ACCESS_LEVELS } from "@/lib/amplify-config";

import { PosSalidasClientPage } from "./components/pos-salidas-client";

export default async function PosSalidasPage() {
  const sessionRes = await getCurrentSession();
  if (!sessionRes.data) {
    redirect("/login?next=/pos/salidas");
  }

  const accessLevel = Number(sessionRes.data.accessLevel ?? 0);
  if (accessLevel < ACCESS_LEVELS.CASHIER) {
    return <AccessDenied />;
  }

  return <PosSalidasClientPage userId={sessionRes.data.userId} />;
}
