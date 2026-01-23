"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import type { StockInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronDown, Minus, Plus, Tag } from "lucide-react";
import { DateCell } from "./date-cell";
function StockActionsCell(props: { row: any; meta: any }) {
  const { row, meta } = props;
  const isExpanded = row.getIsExpanded();
  const name = String(row.original?.name ?? "");

  const [labelsOpen, setLabelsOpen] = React.useState(false);
  const [labelsQty, setLabelsQty] = React.useState(1);

  return (
    <div className="flex items-center justify-end gap-1">
      <AlertDialog
        open={labelsOpen}
        onOpenChange={(open) => {
          setLabelsOpen(open);
          if (open) setLabelsQty(1);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
            title="Enviar a etiquetas"
          >
            <Tag className="h-4 w-4" />
            <span className="sr-only">Enviar a etiquetas</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar a etiquetas</AlertDialogTitle>
            <AlertDialogDescription>
              Producto: <span className="font-medium">{name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <div className="text-sm font-medium">Cantidad de etiquetas</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setLabelsQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={1}
                value={String(labelsQty)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setLabelsQty(Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1);
                }}
                className="w-24 h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setLabelsQty((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await meta.sendToLabels?.(row.original, labelsQty);
                setLabelsOpen(false);
              }}
            >
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          row.toggleExpanded();
        }}
        className="h-8 w-8 p-0"
        title={isExpanded ? "Cerrar" : "Ver detalles"}
      >
        <span className="sr-only">Ver detalles</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </Button>
    </div>
  );
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
    accessorKey: "measurementunit",
    header: "Posición en Almacén",
  },
  {
    accessorKey: "quantity",
    header: "Stock",
    cell: ({ row }) => <div className="text-center">{row.original.quantity ?? 0}</div>,
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
        maximumFractionDigits: 0,
      }).format(amount);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "dateupdated",
    header: "Última Actualización",
    cell: ({ row }) => <DateCell dateString={row.original.dateupdated} />,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const meta = (table.options.meta || {}) as any;
      return <StockActionsCell row={row} meta={meta} />;
    },
  },
];
