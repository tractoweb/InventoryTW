"use client";

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Archive, BadgeDollarSign, CircleDollarSign, Package, PackageCheck, Percent, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal } from "lucide-react";
import type { DashboardOverview } from "@/actions/get-dashboard-overview";
import { HelpPopover } from "@/components/dashboard/help-popover";

type StatsCardsProps = {
  data: DashboardOverview | null;
    error: string | null;
};

export function StatsCards({ data, error }: StatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (error) {
    return (
      <Alert variant="destructive" className="md:col-span-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error al cargar las estadísticas</AlertTitle>
        <AlertDescription>
          No se pudieron cargar las tarjetas de estadísticas. Error: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert className="md:col-span-4">
        <Terminal className="h-4 w-4" />
        <AlertTitle>No hay datos</AlertTitle>
        <AlertDescription>
          Aún no hay productos en el inventario para mostrar estadísticas.
        </AlertDescription>
      </Alert>
    );
  }

  const inv = data.inventory;
  const rec = data.receivables;
  const iva = data.iva;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>Productos</span>
            <HelpPopover
              title="Productos únicos"
              description="Cantidad de productos distintos (SKUs) registrados en el catálogo."
              href="/inventory"
              hrefLabel="Ir a Inventario"
            />
          </CardTitle>
          <PackageCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/inventory" className="text-2xl font-bold hover:underline">
            {inv.productsCount}
          </Link>
          <p className="text-xs text-muted-foreground">Productos únicos</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>Unidades</span>
            <HelpPopover
              title="Unidades en stock"
              description="Suma total de unidades en todos los almacenes (stock actual)."
              href="/stock"
              hrefLabel="Ir a Stock"
            />
          </CardTitle>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/stock" className="text-2xl font-bold hover:underline">
            {inv.totalUnits}
          </Link>
          <p className="text-xs text-muted-foreground">Unidades en stock</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>Bajo Stock</span>
            <HelpPopover
              title="Alertas de bajo stock"
              description="Productos con alerta activa cuyo stock total está por debajo del umbral configurado. Revisa el panel de Alertas para ver el detalle."
              href="/stock"
              hrefLabel="Ir a Stock"
            />
          </CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/stock" className="text-2xl font-bold hover:underline">
            {inv.lowStockCount}
          </Link>
          <p className="text-xs text-muted-foreground">Productos que necesitan atención</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>Agotados</span>
            <HelpPopover
              title="Productos agotados"
              description="Productos cuyo stock total está en 0. Ideal para priorizar reposición o compras."
              href="/stock"
              hrefLabel="Ir a Stock"
            />
          </CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/stock" className="text-2xl font-bold hover:underline">
            {inv.outOfStockCount}
          </Link>
          <p className="text-xs text-muted-foreground">Productos para reponer</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>Costo Inventario</span>
            <HelpPopover
              title="Valor al costo"
              description="Suma de (costo unitario × unidades) de todo el stock. Útil para saber cuánto capital está inmovilizado."
              href="/inventory"
              hrefLabel="Ver productos"
            />
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/inventory" className="text-2xl font-bold hover:underline">
            {formatCurrency(inv.inventoryCostValue)}
          </Link>
          <p className="text-xs text-muted-foreground">Valor de costo del stock</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>Venta Potencial</span>
            <HelpPopover
              title="Precio × stock"
              description="Estimación de venta total si se vendiera el stock al precio actual. Depende de que los productos tengan precio configurado."
              href="/price-lists"
              hrefLabel="Ir a Listas de precios"
            />
          </CardTitle>
          <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/price-lists" className="text-2xl font-bold hover:underline">
            {formatCurrency(inv.inventorySaleValue)}
          </Link>
          <p className="text-xs text-muted-foreground">Precio × stock (estimado)</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>Ganancia Potencial</span>
            <HelpPopover
              title="Venta potencial − costo"
              description="Ganancia estimada (sin gastos) calculada como venta potencial menos costo de inventario. Útil para revisar márgenes."
              href="/price-lists"
              hrefLabel="Ver márgenes"
            />
          </CardTitle>
          <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/price-lists" className="text-2xl font-bold hover:underline">
            {formatCurrency(inv.potentialProfit)}
          </Link>
          <p className="text-xs text-muted-foreground">Venta potencial − costo</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>IVA (Inventario)</span>
            <HelpPopover
              title="IVA estimado del inventario"
              description="Estimación calculada desde impuestos configurados por producto. Sirve como referencia (depende de si el precio incluye impuestos)."
              href="/taxes"
              hrefLabel="Ir a Impuestos"
            />
          </CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/taxes" className="text-2xl font-bold hover:underline">
            {formatCurrency(inv.estimatedIvaOnSaleValue)}
          </Link>
          <p className="text-xs text-muted-foreground">Estimación según impuestos del producto</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>Por Cobrar</span>
            <HelpPopover
              title="Cuentas por cobrar (aprox)"
              description="Suma aproximada de saldos pendientes según documentos de venta y pagos registrados. Si faltan pagos, el valor puede subestimar o sobreestimar."
              href="/documents"
              hrefLabel="Ir a Documentos"
            />
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/documents" className="text-2xl font-bold hover:underline">
            {formatCurrency(rec.pendingAmountApprox)}
          </Link>
          <p className="text-xs text-muted-foreground">{rec.pendingCount} documentos (aprox)</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span>IVA Neto (Período)</span>
            <HelpPopover
              title="IVA ventas − IVA compras"
              description="IVA neto del período consultado (por defecto 30 días). Se calcula desde impuestos por ítem de documento (si existen)."
              href="/documents"
              hrefLabel="Ver documentos"
            />
          </CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Link href="/documents" className="text-2xl font-bold hover:underline">
            {formatCurrency(iva.netIva)}
          </Link>
          <p className="text-xs text-muted-foreground">IVA ventas − IVA compras</p>
        </CardContent>
      </Card>
    </div>
  );
}
