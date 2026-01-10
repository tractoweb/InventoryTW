"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { StockInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { DateCell } from "./date-cell";


export const columns: ColumnDef<StockInfo>[] = [
  {
    accessorKey: "name",
    header: "Nombre",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.name}</div>
    ),
  },
  {
    accessorKey: "code",
    header: "Código/Referencia",
  },
  {
    accessorKey: "measurementunit",
    header: "Posición en Almacén",
  },
  {
    accessorKey: "quantity",
    header: "Stock",
    cell: ({ row }) => (
      <div className="text-center">{row.original.quantity ?? 0}</div>
    ),
  },
  {
    accessorKey: "price",
    header: "Precio",
    cell: ({ row }) => {
        const amount = parseFloat(String(row.original.price));
        const formatted = new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(amount);
        return <div className="text-right font-medium">{formatted}</div>;
      },
  },
  {
    accessorKey: "dateupdated",
    header: "Última Actualización",
    cell: ({ row }) => (
      <DateCell dateString={row.original.dateupdated} />
    ),
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const { toggleRow } = (table.options.meta || {}) as any;
      const isExpanded = row.getIsExpanded();
      
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            row.toggleExpanded();
          }}
          className="h-8 w-8 p-0"
        >
          <span className="sr-only">Abrir menú</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </Button>
      );
    },
  },
];
