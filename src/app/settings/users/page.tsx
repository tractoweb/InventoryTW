import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { AccessDenied } from "@/components/auth/access-denied";

import UsersClientPage from "@/app/users/users-client-page";
import UserForm from "@/components/users/UserForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsUsersPage() {
  const res = await getCurrentSession();
  if (!res.data) return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/settings" backLabel="Volver a configuración" />;
  }

  return (
    <div className="grid gap-6">
      <UsersClientPage />

      <Card>
        <CardHeader>
          <CardTitle>Creación de Usuario</CardTitle>
          <CardDescription>
            Crea usuarios según el esquema de Amplify (userId requerido).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm />
        </CardContent>
      </Card>
    </div>
  );
}
