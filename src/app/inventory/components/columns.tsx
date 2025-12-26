"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { InventoryItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusColors: { [key: string]: string } = {
  "En Stock": "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  "Stock Bajo": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  "Agotado": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};


export const columns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: "name",
    header: "Nombre",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.name}</div>
    ),
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const status = row.original.status as keyof typeof statusColors;
      return (
        <Badge
          variant="outline"
          className={cn(statusColors[status] || '')}
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "quantity",
    header: "Cantidad",
    cell: ({ row }) => (
      <div className="text-center">{row.original.quantity}</div>
    ),
  },
  {
    accessorKey: "category",
    header: "Categoría",
  },
  {
    accessorKey: "manufacturer",
    header: "Fabricante",
  },
  {
    accessorKey: "dateAdded",
    header: "Fecha de Alta",
    cell: ({ row }) => (
      <div>{format(new Date(row.original.dateAdded), "d MMM, yyyy", { locale: es })}</div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(item.id)}
            >
              Copiar ID del artículo
            </DropdownMenuItem>
            <DropdownMenuItem>Editar artículo</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Eliminar artículo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
