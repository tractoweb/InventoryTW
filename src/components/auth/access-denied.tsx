import Link from "next/link";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function AccessDenied({
  title = "Acceso restringido",
  description = "No tienes permisos para ver este módulo.",
  backHref = "/",
  backLabel = "Volver al panel",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-[60vh] w-full grid place-items-center">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Si crees que esto es un error, solicita acceso a un administrador.
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
            {backLabel}
          </Link>
          <Link href="/settings" className={buttonVariants({ variant: "default" })}>
            Ver mi cuenta
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
