"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
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

import { Minus, Plus, Tag } from "lucide-react";

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

function SendToLabelsDialog(props: { product: ProductsMasterTableRow; meta: any }) {
  const { product, meta } = props;
  const name = String(product?.name ?? "");

  const [open, setOpen] = React.useState(false);
  const [qty, setQty] = React.useState(1);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQty(1);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2"
          onClick={(e) => e.stopPropagation()}
          title="Enviar a etiquetas"
        >
          <Tag className="h-4 w-4 mr-2" />
          Etiquetas
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
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min={1}
              value={String(qty)}
              onChange={(e) => {
                const n = Number(e.target.value);
                setQty(Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1);
              }}
              className="w-24 h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setQty((q) => q + 1)}
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
              await meta.sendToLabels?.(product, qty);
              setOpen(false);
            }}
          >
            Enviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
    cell: ({ row, table }) => {
      const meta: any = table.options.meta ?? {};
      const id = Number(row.original.id);
      const name = String(row.original.name ?? "");
      const canDeactivate = Boolean(meta.canDeactivate);
      return (
        <div className="min-w-0">
          <div className="font-medium truncate" title={name}>
            {name}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 bg-emerald-600 px-2 text-white hover:bg-emerald-700"
              onClick={(e) => {
                e.stopPropagation();
                meta.openProductDetails?.(id);
              }}
            >
              Detalles
            </Button>

            <SendToLabelsDialog product={row.original} meta={meta} />

            {canDeactivate ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Desactivar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar desactivación</AlertDialogTitle>
                    <AlertDialogDescription>
                      ¿Estás seguro de desactivar <span className="font-medium">{name}</span>?\n
                      <span className="mt-2 block">
                        Esto no elimina el producto: solo lo oculta y evita su uso para mantener la trazabilidad.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        await meta.handleDeleteProduct?.(id);
                      }}
                    >
                      Desactivar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>
      );
    },
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
    accessorKey: "updatedAt",
    header: "Actualizado",
    cell: ({ row }) => <div className="text-xs text-muted-foreground">{row.original.updatedAt ?? "—"}</div>,
  },
];
