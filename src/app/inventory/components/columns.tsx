"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import type { ProductInventory } from "@/lib/types";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ViewProductDetails } from "./view-product-details";
import { EditProductForm } from "./edit-product-form";

const DateCell = ({ dateString }: { dateString: string }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Renderiza la fecha como string en el servidor y en la primera carga del cliente
    return <div>{new Date(dateString).toLocaleDateString('es-ES')}</div>;
  }
  // Formatea la fecha en el cliente después de montar el componente
  return <div>{format(new Date(dateString), "d MMM, yyyy HH:mm", { locale: es })}</div>;
}


export const columns: ColumnDef<ProductInventory>[] = [
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
    header: "Unidad Medida",
    cell: ({ row }) => (
        <div>{row.original.measurementunit || 'N/A'}</div>
    ),
  },
  {
    accessorKey: "price",
    header: "Precio",
    cell: ({ row }) => {
        const amount = parseFloat(String(row.original.price));
        const formatted = new Intl.NumberFormat("es-ES", {
          style: "currency",
          currency: "EUR", // Se podría hacer dinámico con product.currencyid
        }).format(amount);
        return <div className="text-right font-medium">{formatted}</div>;
      },
  },
  {
    accessorKey: "totalstock",
    header: "Stock Total",
    cell: ({ row }) => (
      <div className="text-center">{row.original.totalstock ?? 0}</div>
    ),
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
    cell: ({ row }) => {
      const item = row.original;
      const [isViewOpen, setViewOpen] = useState(false);
      const [isEditOpen, setEditOpen] = useState(false);

      return (
        <>
          <ViewProductDetails 
            productId={item.id} 
            isOpen={isViewOpen} 
            setOpen={setViewOpen} 
          />
          <EditProductForm
            productId={item.id}
            isOpen={isEditOpen}
            setOpen={setEditOpen}
          />
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
              <DropdownMenuItem onClick={() => setViewOpen(true)}>
                Ver más información
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                Editar producto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
