"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

import type { ProductsMasterTableRow } from "./products-master-client";

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return formatted;
}

export const productsMasterColumns: ColumnDef<ProductsMasterTableRow>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="font-mono text-xs">{row.original.id}</div>,
  },
  {
    accessorKey: "code",
    header: "Código",
    cell: ({ row }) => <div className="font-mono text-xs">{row.original.code ?? "—"}</div>,
  },
  {
    accessorKey: "name",
    header: "Nombre",
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: "productGroupName",
    header: "Grupo",
    cell: ({ row }) => <div className="text-sm">{row.original.productGroupName ?? "—"}</div>,
  },
  {
    accessorKey: "measurementUnit",
    header: "Ubicación",
    cell: ({ row }) => <div className="text-sm">{row.original.measurementUnit ?? "—"}</div>,
  },
  {
    accessorKey: "cost",
    header: "Costo",
    cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.original.cost)}</div>,
  },
  {
    accessorKey: "price",
    header: "Precio",
    cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.original.price)}</div>,
  },
  {
    accessorKey: "taxesText",
    header: "Impuestos",
    cell: ({ row }) => <div className="text-sm truncate max-w-[220px]">{row.original.taxesText ?? "—"}</div>,
  },
  {
    accessorKey: "barcodesText",
    header: "Barcodes",
    cell: ({ row }) => <div className="text-sm truncate max-w-[220px]">{row.original.barcodesText ?? "—"}</div>,
  },
  {
    accessorKey: "isEnabled",
    header: "Activo",
    cell: ({ row }) => <div className="text-center">{row.original.isEnabled ? "✓" : "—"}</div>,
  },
  {
    accessorKey: "createdAt",
    header: "Creado",
    cell: ({ row }) => <div className="text-xs text-muted-foreground">{row.original.createdAt ?? "—"}</div>,
  },
  {
    accessorKey: "updatedAt",
    header: "Actualizado",
    cell: ({ row }) => <div className="text-xs text-muted-foreground">{row.original.updatedAt ?? "—"}</div>,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
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
          <span className="sr-only">Desplegar detalles</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </Button>
      );
    },
  },
];
