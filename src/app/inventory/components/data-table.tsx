
"use client";

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
    getExpandedRowModel,
  getSortedRowModel,
    Row,
    Table as TanstackTable,
  SortingState,
} from "@tanstack/react-table";
import { EditProductForm } from './edit-product-form';
import { ViewProductDetails } from './view-product-details';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { StockQuickAdjust } from './stock-quick-adjust';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  meta: any;
}

export function DataTable<TData extends { id: number }, TValue>({
  columns,
  data: initialData,
  meta,
}: DataTableProps<TData, TValue>) {
    const [expandedRows, setExpandedRows] = useState({});
    const [sorting, setSorting] = useState<SortingState>([]);
    const [jumpTo, setJumpTo] = useState<string>("");

    const table = useReactTable({
        data: initialData,
        columns,
        state: {
            expanded: expandedRows,
        sorting,
        },
        meta: {
            ...meta,
            toggleRow: (rowId: string) => {
                setExpandedRows(prev => ({ ...prev, [rowId]: !(prev as any)[rowId] }));
            },
            closeRow: (rowId: string) => {
                setExpandedRows(prev => ({ ...prev, [rowId]: false }));
            }
        },
        onExpandedChange: setExpandedRows,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getRowId: (row) => String(row.id),
        initialState: {
            pagination: {
                pageSize: 10,
            }
        }
    });

    const disableRowExpansion = Boolean((table.options.meta as any)?.disableRowExpansion);

    const pageCount = table.getPageCount();
    const currentPage = table.getState().pagination.pageIndex + 1;

  return (
    <div className="rounded-md border w-full min-w-0">
      <div className="w-full overflow-x-auto">
        <Table className="min-w-max">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    className={canSort ? "select-none cursor-pointer" : undefined}
                    title={canSort ? "Ordenar" : undefined}
                  >
                    <div className="flex items-center gap-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort ? (
                        <span className="text-xs text-muted-foreground">
                          {sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : ""}
                        </span>
                      ) : null}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                    <TableRow
                        data-state={row.getIsExpanded() ? "open" : "closed"}
                        className="data-[state=open]:bg-muted/50"
                    >
                         {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} onClick={() => {
                      if (disableRowExpansion) return;
                      // Solo expandir si no es la celda de acciones
                      if (cell.column.id !== 'actions') row.toggleExpanded();
                            }}
                      className={!disableRowExpansion && cell.column.id !== 'actions' ? 'cursor-pointer' : ''}
                            >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                {!disableRowExpansion && row.getIsExpanded() && (
                        <TableRow key={`${row.id}-expanded`} className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={columns.length}>
                                <ExpandedContent row={row} table={table} />
                            </TableCell>
                        </TableRow>
                    )}
                </React.Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center"
              >
                No hay resultados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4 px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Anterior
        </Button>
        <span className="text-sm">
          Página {currentPage} de {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Ir a…"
            value={jumpTo}
            onChange={(e) => setJumpTo(e.target.value)}
            className="h-8 w-[90px]"
            inputMode="numeric"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const n = Number(jumpTo);
              if (!Number.isFinite(n) || n < 1 || n > pageCount) return;
              table.setPageIndex(Math.trunc(n) - 1);
            }}
            disabled={!jumpTo.trim()}
          >
            Ir
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}

// A new sub-component for the expanded content
function ExpandedContent<TData extends { id: number }>({ row, table }: { row: Row<TData>, table: TanstackTable<TData> }) {
  const { closeRow, productGroups, taxes, handleDeleteProduct, pageType, warehouses } = (table.options.meta || {}) as any;

  const isStockPage = pageType === "stock";

  if (isStockPage) {
    return (
      <div className="py-4">
        <StockQuickAdjust
          productId={Number((row.original as any).id)}
          warehouses={Array.isArray(warehouses) ? warehouses : []}
        />
      </div>
    );
  }

    return (
        <Tabs defaultValue="details" className="w-full py-4">
            <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="details">Ver Detalles</TabsTrigger>
                <TabsTrigger value="edit">Editar</TabsTrigger>
            <TabsTrigger value="delete" className="text-destructive">Desactivar</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
                <ViewProductDetails productId={(row.original as any).id} />
            </TabsContent>
            <TabsContent value="edit">
                <EditProductForm 
                    productId={(row.original as any).id}
                    productGroups={productGroups}
                    taxes={taxes}
                    onClose={() => closeRow(row.id)}
                />
            </TabsContent>
            <TabsContent value="delete">
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
                <h3 className="text-lg font-semibold text-destructive">Desactivar Producto</h3>
                    <p className="mt-2 text-sm text-destructive/80">
                  Esta acción desactiva el producto (no se elimina) para conservar trazabilidad.
                  Podrás reactivarlo más tarde desde la pestaña de "Editar".
                    </p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="mt-4">
                                <Trash2 className="mr-2 h-4 w-4" />
                      Desactivar producto
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                    Se desactivará el producto `{(row.original as any).name}` (no se eliminará).
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteProduct((row.original as any).id)}>
                    Sí, desactivar producto
                            </AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </TabsContent>
        </Tabs>
    )
}
