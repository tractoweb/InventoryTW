import Link from "next/link";

import { requireSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";

import { getDashboardStats } from "@/actions/get-dashboard-stats";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function ReportsPage() {
	await requireSession(ACCESS_LEVELS.CASHIER);

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
						<Button asChild variant="outline">
							<Link href="/reports/low-stock">Ver</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Agotados</CardTitle>
						<CardDescription>Stock total en 0.</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center justify-between gap-3">
						<div className="text-3xl font-bold">{stats?.outOfStockCount ?? 0}</div>
						<Button asChild variant="outline">
							<Link href="/reports/out-of-stock">Ver</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Comparación</CardTitle>
						<CardDescription>Posibles duplicados.</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center justify-between gap-3">
						<div className="text-sm text-muted-foreground">Nombre / Código</div>
						<Button asChild variant="outline">
							<Link href="/reports/comparison">Abrir</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Stock</CardTitle>
						<CardDescription>Gestión por almacén.</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center justify-end">
						<Button asChild>
							<Link href="/stock">Ir a Stock</Link>
						</Button>
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
					<Button asChild variant="outline">
						<Link href="/documents">Documentos</Link>
					</Button>
					<Button asChild variant="outline">
						<Link href="/kardex">Kardex</Link>
					</Button>
					<Button asChild variant="outline">
						<Link href="/inventory">Productos</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
