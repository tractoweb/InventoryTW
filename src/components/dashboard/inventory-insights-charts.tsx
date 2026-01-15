"use client";

import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { HelpPopover } from "@/components/dashboard/help-popover";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Cell,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type InventoryInsightsChartsProps = {
  inventoryByWarehouse: Array<{
    warehouseId: number;
    warehouseName: string;
    units: number;
    costValue: number;
    saleValue: number;
  }>;
  inventoryByGroup: Array<{
    productGroupId: number;
    groupName: string;
    units: number;
    costValue: number;
    saleValue: number;
  }>;
  topProductsByProfit: Array<{
    productId: number;
    productName: string;
    units: number;
    costValue: number;
    saleValue: number;
    profit: number;
  }>;
  priceCostScatter: Array<{
    productId: number;
    productName: string;
    price: number;
    cost: number;
    units: number;
  }>;
};

function formatCurrencyShort(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0";

  return new Intl.NumberFormat("es-CO", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatCurrency(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function truncateLabel(value: unknown, max = 14) {
  const s = String(value ?? "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

export function InventoryInsightsCharts({
  inventoryByWarehouse,
  inventoryByGroup,
  topProductsByProfit,
  priceCostScatter,
}: InventoryInsightsChartsProps) {
  const router = useRouter();

  const groupPieData = (inventoryByGroup ?? []).map((g) => ({
    name: g.groupName,
    value: g.saleValue,
    productGroupId: g.productGroupId,
  }));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Insights de Inventario</span>
          <HelpPopover
            title="Cómo usar estos gráficos"
            description={
              "Estos gráficos resumen inventario por almacén/grupo y rentabilidad. Puedes hacer clic en barras/segmentos/puntos para ir a la pantalla relacionada (Stock o Inventario) con una búsqueda prellenada."
            }
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        <Tabs defaultValue="warehouse">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="warehouse">Por almacén</TabsTrigger>
            <TabsTrigger value="group">Por grupo</TabsTrigger>
            <TabsTrigger value="top">Top rentabilidad</TabsTrigger>
            <TabsTrigger value="scatter">Costo vs precio</TabsTrigger>
          </TabsList>

          <TabsContent value="warehouse">
            <ChartContainer
              config={{
                saleValue: { label: "Venta", color: "hsl(var(--chart-1))" },
                costValue: { label: "Costo", color: "hsl(var(--chart-2))" },
              }}
              className="h-[360px] w-full min-w-0 overflow-hidden aspect-auto"
            >
              <BarChart
                data={inventoryByWarehouse}
                margin={{ left: 8, right: 8, top: 8, bottom: 40 }}
                onClick={(e: any) => {
                  const name = e?.activePayload?.[0]?.payload?.warehouseName;
                  if (name) router.push(`/stock?q=${encodeURIComponent(String(name))}`);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="warehouseName"
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={70}
                  tickFormatter={(v) => truncateLabel(v, 16)}
                />
                <YAxis tickFormatter={formatCurrencyShort} width={70} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="saleValue" fill="var(--color-saleValue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="costValue" fill="var(--color-costValue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Tip: haz clic en una barra para abrir <span className="font-medium">Stock</span> filtrado por almacén.
            </p>
          </TabsContent>

          <TabsContent value="group">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartContainer
                config={{
                  saleValue: { label: "Venta", color: "hsl(var(--chart-1))" },
                }}
                className="h-[320px] w-full min-w-0 overflow-hidden aspect-auto"
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v: any) => {
                          const n = Number(v ?? 0);
                          return <span className="font-mono">{formatCurrency(n)}</span>;
                        }}
                      />
                    }
                  />
                  <Pie
                    data={groupPieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                    onClick={(data: any) => {
                      const gid = Number(data?.payload?.productGroupId);
                      if (Number.isFinite(gid) && gid > 0) router.push(`/inventory?groupId=${gid}`);
                    }}
                  >
                    {groupPieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>

              <ChartContainer
                config={{
                  saleValue: { label: "Venta", color: "hsl(var(--chart-1))" },
                  units: { label: "Unidades", color: "hsl(var(--chart-3))" },
                }}
                className="h-[320px] w-full min-w-0 overflow-hidden aspect-auto"
              >
                <BarChart
                  data={inventoryByGroup}
                  margin={{ left: 8, right: 8, top: 8, bottom: 40 }}
                  onClick={(e: any) => {
                    const gid = Number(e?.activePayload?.[0]?.payload?.productGroupId);
                    if (Number.isFinite(gid) && gid > 0) router.push(`/inventory?groupId=${gid}`);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="groupName"
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={70}
                    tickFormatter={(v) => truncateLabel(v, 16)}
                  />
                  <YAxis yAxisId="left" tickFormatter={formatCurrencyShort} width={70} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => String(v)} width={50} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="saleValue" fill="var(--color-saleValue)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="units" fill="var(--color-units)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tip: haz clic en un grupo para abrir <span className="font-medium">Inventario</span> filtrado por grupo.
            </p>
          </TabsContent>

          <TabsContent value="top">
            <ChartContainer
              config={{
                profit: { label: "Ganancia", color: "hsl(var(--chart-1))" },
                saleValue: { label: "Venta", color: "hsl(var(--chart-3))" },
              }}
              className="h-[360px] w-full min-w-0 overflow-hidden aspect-auto"
            >
              <BarChart
                data={topProductsByProfit}
                layout="vertical"
                margin={{ left: 12, right: 12, top: 8, bottom: 8 }}
                onClick={(e: any) => {
                  const name = e?.activePayload?.[0]?.payload?.productName;
                  if (name) router.push(`/inventory?q=${encodeURIComponent(String(name))}`);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={formatCurrencyShort} />
                <YAxis type="category" dataKey="productName" width={160} tickFormatter={(v) => truncateLabel(v, 22)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="profit" fill="var(--color-profit)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="saleValue" fill="var(--color-saleValue)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Tip: haz clic en un producto para abrir <span className="font-medium">Inventario</span> con búsqueda por nombre.
            </p>
          </TabsContent>

          <TabsContent value="scatter">
            <ChartContainer
              config={{
                cost: { label: "Costo", color: "hsl(var(--chart-2))" },
                price: { label: "Precio", color: "hsl(var(--chart-1))" },
              }}
              className="h-[360px] w-full min-w-0 overflow-hidden aspect-auto"
            >
              <ScatterChart margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="cost" name="Costo" tickFormatter={formatCurrencyShort} />
                <YAxis type="number" dataKey="price" name="Precio" tickFormatter={formatCurrencyShort} />
                <ZAxis type="number" dataKey="units" range={[20, 260]} name="Unidades" />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value: any, name: any) => {
                        if (name === "units") return <span className="font-mono">{String(value)} u</span>;
                        return <span className="font-mono">{formatCurrency(Number(value ?? 0))}</span>;
                      }}
                      labelFormatter={(_, payload) => {
                        const p: any = Array.isArray(payload) ? payload[0]?.payload : null;
                        return p?.productName ? `Producto: ${p.productName}` : "";
                      }}
                    />
                  }
                />
                <Scatter
                  name="Productos"
                  data={priceCostScatter}
                  fill="hsl(var(--chart-4))"
                  onClick={(data: any) => {
                    const name = data?.payload?.productName;
                    if (name) router.push(`/inventory?q=${encodeURIComponent(String(name))}`);
                  }}
                />
              </ScatterChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Tip: haz clic en un punto para abrir <span className="font-medium">Inventario</span> con búsqueda por nombre.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
