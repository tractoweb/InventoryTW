import Link from "next/link";

import UserForm from "@/components/users/UserForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
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
          <Card>
            <CardHeader>
              <CardTitle>Preferencias de Aplicación</CardTitle>
              <CardDescription>
                Aquí iremos agregando temas/colores, formatos, moneda y almacén por defecto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sugerencia: empezar por <strong>ApplicationSettings</strong> (color primario, logo,
                formatos de fecha/hora, porcentaje de impuesto, allowNegativeStock).
              </p>
              <div className="mt-3">
                <Link className="text-sm underline" href="/tables">
                  Ver tablas (modo admin)
                </Link>
              </div>
            </CardContent>
          </Card>
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
              <div className="mt-3">
                <Link className="text-sm underline" href="/tables">
                  Ver tablas (modo admin)
                </Link>
              </div>
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
              <div className="mt-3">
                <Link className="text-sm underline" href="/tables">
                  Ver tablas (modo admin)
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
