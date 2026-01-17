import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";

import { ProfileClientPage } from "./profile-client-page";

export default async function ProfilePage() {
  const res = await getCurrentSession();
  if (!res.data) redirect("/login?next=/profile");

  return <ProfileClientPage />;
}
