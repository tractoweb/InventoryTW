"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { StockInfo } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
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
    accessorKey: "warehousename",
    header: "Almacén",
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
        const formatted = new Intl.NumberFormat("es-ES", {
          style: "currency",
          currency: "EUR", // Se podría hacer dinámico
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
      const item = row.original;
      const { onView, onEdit } = table.options.meta as {
        onView: (id: number) => void;
        onEdit: (id: number) => void;
      };

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menú</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onView(item.id)}>
              Ver más información
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(item.id)}>
              Editar producto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
