import { StatsCards } from "@/components/dashboard/stats-cards";
import { InventoryChart } from "@/components/dashboard/inventory-chart";
import { RecentItems } from "@/components/dashboard/recent-items";
import { ReceivablesPanel } from "@/components/dashboard/receivables-panel";
import { DashboardTrendsChart } from "@/components/dashboard/dashboard-trends-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { InventoryInsightsCharts } from "@/components/dashboard/inventory-insights-charts";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardOverview } from "@/actions/get-dashboard-overview";
import { getStockData } from "@/actions/get-stock-data";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewWrapper />
      </Suspense>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* InventoryChart fetches its own data client-side, that is fine */}
        <InventoryChart className="lg:col-span-2" />
        <Suspense fallback={<RecentItemsSkeleton />}>
          <RecentItemsWrapper />
        </Suspense>
      </div>
    </div>
  );
}

async function OverviewWrapper() {
  const { data, error } = await getDashboardOverview({ days: 30 });

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Panel de Control</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No se pudo cargar el resumen. {error ?? "Sin datos."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <StatsCards data={data} error={null} />
      <DashboardTrendsChart data={data.trends.byDay} from={data.window.from} to={data.window.to} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <InventoryInsightsCharts
          inventoryByWarehouse={data.charts.inventoryByWarehouse}
          inventoryByGroup={data.charts.inventoryByGroup}
          topProductsByProfit={data.charts.topProductsByProfit}
          priceCostScatter={data.charts.priceCostScatter}
        />
        <ReceivablesPanel
          rows={data.receivables.topOverdue}
          pendingCount={data.receivables.pendingCount}
          pendingAmountApprox={data.receivables.pendingAmountApprox}
          overdueCount={data.receivables.overdueCount}
          overdueAmountApprox={data.receivables.overdueAmountApprox}
        />
      </div>

      <AlertsPanel lowStock={data.alerts.lowStock} />
    </div>
  );
}

async function RecentItemsWrapper() {
    const { data, error } = await getStockData();
  return <RecentItems items={data ?? null} error={error} />;
}


function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">&nbsp;</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-40 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ventas vs Compras</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[320px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cuentas por cobrar</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-44 w-full mt-4" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Insights de Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[360px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-44 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function RecentItemsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Añadidos Recientemente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
