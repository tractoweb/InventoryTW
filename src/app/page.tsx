import { StatsCards } from "@/components/dashboard/stats-cards";
import { InventoryChart } from "@/components/dashboard/inventory-chart";
import { RecentItems } from "@/components/dashboard/recent-items";
import { inventoryItems } from "@/lib/data";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsCards />
      </Suspense>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Suspense fallback={<ChartSkeleton />}>
          <InventoryChart className="lg:col-span-2" />
        </Suspense>
        <Suspense fallback={<RecentItemsSkeleton />}>
          <RecentItems items={inventoryItems.slice(0, 5)} />
        </Suspense>
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-40 mt-1" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24 mt-1" />
        </CardContent>
      </Card>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Items by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full h-[350px]" />
      </CardContent>
    </Card>
  )
}

function RecentItemsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently Added</CardTitle>
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
