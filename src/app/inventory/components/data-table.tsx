
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
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
    getExpandedRowModel,
    Row,
    Table as TanstackTable,
} from "@tanstack/react-table";
import { EditProductForm } from './edit-product-form';
import { ViewProductDetails } from './view-product-details';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React from 'react';

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

    const table = useReactTable({
        data: initialData,
        columns,
        state: {
            expanded: expandedRows,
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
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getRowId: (row) => String(row.id),
        initialState: {
            pagination: {
                pageSize: 10,
            }
        }
    });

    const pageCount = table.getPageCount();
    const currentPage = table.getState().pagination.pageIndex + 1;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
                                // Solo expandir si no es la celda de acciones
                                if (cell.column.id !== 'actions') {
                                    row.toggleExpanded();
                                }
                            }}
                                className={cell.column.id !== 'actions' ? 'cursor-pointer' : ''}
                            >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                    {row.getIsExpanded() && (
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
    const { closeRow, productGroups, taxes } = (table.options.meta || {}) as any;

    return (
        <Tabs defaultValue="details" className="w-full py-4">
            <TabsList className="mb-4">
                <TabsTrigger value="details">Ver Detalles</TabsTrigger>
                <TabsTrigger value="edit">Editar</TabsTrigger>
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
        </Tabs>
    )
}
