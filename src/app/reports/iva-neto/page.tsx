import Link from "next/link";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { AccessDenied } from "@/components/auth/access-denied";
import { cn } from "@/lib/utils";

import { getIvaNeto30dReport } from "@/actions/get-iva-neto-30d";
import { IvaNeto30dClient } from "@/components/reports/iva-neto-30d-client";

import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function IvaNetoReportPage() {
  const s = await getCurrentSession();
  if (!s.data) redirect("/login?next=%2Freports%2Fiva-neto");
  if (Number(s.data.accessLevel) < ACCESS_LEVELS.CASHIER) {
    return <AccessDenied backHref="/reports" backLabel="Volver a Informes" />;
  }

  const res = await getIvaNeto30dReport({ days: 30 });

  if (res.error || !res.data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">IVA neto</h1>
            <p className="text-muted-foreground">Cálculo de IVA ventas vs compras (30 días).</p>
          </div>
          <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }))}>
            Volver
          </Link>
        </div>

        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{res.error ?? "No se pudo cargar el reporte."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IVA neto</h1>
          <p className="text-muted-foreground">Últimos 30 días. Ventas − Compras, con trazabilidad por documento.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }))}>
            Volver
          </Link>
        </div>
      </div>

      <IvaNeto30dClient report={res.data} />
    </div>
  );
}
