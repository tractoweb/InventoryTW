import Link from "next/link";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { AccessDenied } from "@/components/auth/access-denied";

import { getDashboardStats } from "@/actions/get-dashboard-stats";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export default async function ReportsPage() {
	const res = await getCurrentSession();
	if (!res.data) redirect("/login?next=%2Freports");
	if (Number(res.data.accessLevel) < ACCESS_LEVELS.CASHIER) {
		return <AccessDenied backHref="/" backLabel="Volver al panel" />;
	}

	const statsRes = await getDashboardStats();
	const error = statsRes.error;
	const stats = statsRes.data;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<h1 className="text-3xl font-bold tracking-tight">Informes</h1>
				<p className="text-muted-foreground">
					Resúmenes y módulos de análisis. Todo conectado con Inventario, Stock, Documentos y Kardex.
				</p>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader>
						<CardTitle>Bajo stock</CardTitle>
						<CardDescription>Productos bajo el umbral.</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center justify-between gap-3">
						<div className="text-3xl font-bold">{stats?.lowStockCount ?? 0}</div>
						<Link href="/reports/low-stock" className={cn(buttonVariants({ variant: "outline" }))}>
							Ver
						</Link>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Agotados</CardTitle>
						<CardDescription>Stock total en 0.</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center justify-between gap-3">
						<div className="text-3xl font-bold">{stats?.outOfStockCount ?? 0}</div>
						<Link href="/reports/out-of-stock" className={cn(buttonVariants({ variant: "outline" }))}>
							Ver
						</Link>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Comparación</CardTitle>
						<CardDescription>Posibles duplicados.</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center justify-between gap-3">
						<div className="text-sm text-muted-foreground">Nombre / Código</div>
						<Link href="/reports/comparison" className={cn(buttonVariants({ variant: "outline" }))}>
							Abrir
						</Link>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Stock</CardTitle>
						<CardDescription>Gestión por almacén.</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-sm text-muted-foreground">
							Accede desde el menú principal.
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Siguientes módulos</CardTitle>
					<CardDescription>
						Costo, Venta potencial, IVA y Por cobrar requieren consolidar Documentos + Pagos + Kardex.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Link href="/documents" className={cn(buttonVariants({ variant: "outline" }))}>
						Documentos
					</Link>
					<Link href="/kardex" className={cn(buttonVariants({ variant: "outline" }))}>
						Kardex
					</Link>
					<Link href="/inventory" className={cn(buttonVariants({ variant: "outline" }))}>
						Productos
					</Link>
				</CardContent>
			</Card>
		</div>
	);
}
