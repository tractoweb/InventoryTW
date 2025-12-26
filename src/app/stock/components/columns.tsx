"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { StockInfo } from "@/lib/types";
import { DateCell } from "@/app/inventory/components/date-cell";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
    }).format(amount);
}

export const columns: ColumnDef<StockInfo>[] = [
  {
    accessorKey: "name",
    header: "Nombre",
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
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
    header: "Cantidad",
    cell: ({ row }) => <div className="text-center">{row.original.quantity}</div>,
  },
  {
    accessorKey: "price",
    header: "Precio",
    cell: ({ row }) => <div className="text-right">{formatCurrency(row.original.price)}</div>,
  },
  {
    accessorKey: "cost",
    header: "Costo",
    cell: ({ row }) => <div className="text-right">{formatCurrency(row.original.cost)}</div>,
  },
  {
    accessorKey: "datecreated",
    header: "Fecha Creación",
    cell: ({ row }) => <DateCell dateString={row.original.datecreated} />,
  },
  {
    accessorKey: "dateupdated",
    header: "Última Actualización",
    cell: ({ row }) => <DateCell dateString={row.original.dateupdated} />,
  },
];
