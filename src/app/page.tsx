import { StatsCards } from "@/components/dashboard/stats-cards";
import { InventoryChart } from "@/components/dashboard/inventory-chart";
import { RecentItems } from "@/components/dashboard/recent-items";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardStats } from "@/actions/get-dashboard-stats";
import { getStockData } from "@/actions/get-stock-data";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsCardsWrapper />
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

async function StatsCardsWrapper() {
  const { data, error } = await getDashboardStats();
  return <StatsCards data={data ?? null} error={error} />;
}

async function RecentItemsWrapper() {
    const { data, error } = await getStockData();
  return <RecentItems items={data ?? null} error={error} />;
}


function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Unidades</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-40 mt-1" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Agotados</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-24 mt-1" />
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
