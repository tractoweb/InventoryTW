import { redirect } from "next/navigation";

export default function UserSecurityRedirectPage() {
  redirect("/settings");
}
