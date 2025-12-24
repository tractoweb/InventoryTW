"use client";

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
import { inventoryItems } from "@/lib/data";
import { ChartTooltipContent } from "../ui/chart";

const data = inventoryItems.reduce((acc, item) => {
  const category = acc.find((c) => c.category === item.category);
  if (category) {
    category.inStock += item.status === "In Stock" ? item.quantity : 0;
    category.lowStock += item.status === "Low Stock" ? item.quantity : 0;
  } else {
    acc.push({
      category: item.category,
      inStock: item.status === "In Stock" ? item.quantity : 0,
      lowStock: item.status === "Low Stock" ? item.quantity : 0,
    });
  }
  return acc;
}, [] as { category: string; inStock: number; lowStock: number }[]);

export function InventoryChart({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Items by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <XAxis
              dataKey="category"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
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
            <Bar dataKey="inStock" name="In Stock" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lowStock" name="Low Stock" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
