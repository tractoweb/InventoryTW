import Link from "next/link";

import UserForm from "@/components/users/UserForm";
import ApplicationSettingsForm from "@/components/settings/application-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";

export default async function SettingsPage() {
  await requireSession(ACCESS_LEVELS.ADMIN);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra usuarios y parámetros generales del sistema.
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="app">Aplicación</TabsTrigger>
          <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
          <TabsTrigger value="advanced">Avanzado</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="pt-4">
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
        </TabsContent>

        <TabsContent value="app" className="pt-4">
          <div className="grid gap-4">
            <ApplicationSettingsForm />
          </div>
        </TabsContent>

        <TabsContent value="catalogs" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Catálogos</CardTitle>
              <CardDescription>
                Mantención de maestros: impuestos, tipos de pago, almacenes, tipos/categorías de documento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Esto normalmente mapea a: <strong>Tax</strong>, <strong>PaymentType</strong>,
                <strong>Warehouse</strong>, <strong>DocumentType</strong>, <strong>DocumentCategory</strong>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Avanzado</CardTitle>
              <CardDescription>
                Opciones de sistema: contadores/secuencias, plantillas y propiedades.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Recomendado: configurar <strong>Counter</strong> para secuencias de IDs y
                <strong>Template</strong>/<strong>ApplicationProperty</strong>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
