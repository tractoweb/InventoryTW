"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { HelpPopover } from "@/components/dashboard/help-popover";
import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

type DashboardTrendsChartProps = {
  data: Array<{
    date: string;
    salesTotal: number;
    purchaseTotal: number;
    salesIva: number;
    purchaseIva: number;
  }>;
  from: string;
  to: string;
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

export function DashboardTrendsChart({ data, from, to }: DashboardTrendsChartProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>
            Ventas vs Compras ({from} → {to})
          </span>
          <HelpPopover
            title="Qué muestra este gráfico"
            description="Series diarias de totales de ventas/compras e IVA del período. Útil para ver tendencias y picos por día."
            href="/documents"
            hrefLabel="Abrir Documentos"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            salesTotal: { label: "Ventas", color: "hsl(var(--chart-1))" },
            purchaseTotal: { label: "Compras", color: "hsl(var(--chart-2))" },
            salesIva: { label: "IVA Ventas", color: "hsl(var(--chart-3))" },
            purchaseIva: { label: "IVA Compras", color: "hsl(var(--chart-4))" },
          }}
          className="h-[320px] w-full min-w-0 overflow-hidden aspect-auto"
        >
          <AreaChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickMargin={8} minTickGap={20} />
            <YAxis tickFormatter={formatCurrencyShort} width={70} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />

            <Area type="monotone" dataKey="salesTotal" stroke="var(--color-salesTotal)" fill="var(--color-salesTotal)" fillOpacity={0.15} />
            <Area type="monotone" dataKey="purchaseTotal" stroke="var(--color-purchaseTotal)" fill="var(--color-purchaseTotal)" fillOpacity={0.12} />
            <Area type="monotone" dataKey="salesIva" stroke="var(--color-salesIva)" fill="var(--color-salesIva)" fillOpacity={0.10} />
            <Area type="monotone" dataKey="purchaseIva" stroke="var(--color-purchaseIva)" fill="var(--color-purchaseIva)" fillOpacity={0.08} />
          </AreaChart>
        </ChartContainer>

        <div className="mt-2 text-xs text-muted-foreground">
          Ir a <Link href="/documents" className="underline underline-offset-2">Documentos</Link> para ver el detalle.
        </div>
      </CardContent>
    </Card>
  );
}
