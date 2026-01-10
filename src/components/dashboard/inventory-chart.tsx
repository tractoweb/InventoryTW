"use client";

import { use, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "../ui/chart";
import { getStockData } from "@/actions/get-stock-data";
import { Skeleton } from "../ui/skeleton";
import { Alert, AlertDescription } from "../ui/alert";
import { Terminal } from "lucide-react";
import type { Product } from "@/lib/types";

type ChartData = {
  category: string;
  [key: string]: string | number;
};

// Se ejecuta del lado del cliente para obtener datos y renderizar
export function InventoryChart({ className }: { className?: string }) {
  const [data, setData] = useState<ChartData[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [chartConfig, setChartConfig] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getStockData();
        if (result.error) {
          setError(result.error);
          setIsLoading(false);
          return;
        }

        const items = result.data || [];
        
        // Agrupar por nombre de producto y sumar el stock de todos los almacenes
        const productStock: { [key: string]: number } = {};
        items.forEach(item => {
          if (productStock[item.name]) {
            productStock[item.name] += item.totalStock || 0;
          } else {
            productStock[item.name] = item.totalStock || 0;
          }
        });

        // Tomar los 5 productos con más stock
        const top5Products = Object.entries(productStock)
            .sort(([, qtyA], [, qtyB]) => qtyB - qtyA)
            .slice(0, 5);

        // Crear los datos para el gráfico
        const chartData = top5Products.map(([name, quantity]) => ({
            name: name,
            quantity: quantity,
        }));
        
        const newChartConfig = {
            quantity: {
              label: "Cantidad Total",
              color: "hsl(var(--chart-1))",
            },
          };

        setData(chartData as any);
        setChartConfig(newChartConfig);

      } catch (err: any) {
        setError(err.message || "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Top 5 Productos por Stock Total</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="w-full h-[350px]" />
        ) : error ? (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[350px]">
            <p className="text-muted-foreground">No hay datos suficientes para mostrar el gráfico.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="min-h-[200px] w-full h-[350px]">
            <BarChart data={data} layout="vertical">
              <YAxis
                dataKey="name"
                type="category"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={120}
                tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
              />
              <XAxis
                type="number"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={<ChartTooltipContent />}
              />
              <Legend />
              <Bar dataKey="quantity" name="Cantidad Total" fill="var(--color-quantity)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
