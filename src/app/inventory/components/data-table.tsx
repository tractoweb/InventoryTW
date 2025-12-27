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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
    getExpandedRowModel,
} from "@tanstack/react-table";
import { EditProductForm } from './edit-product-form';
import { ViewProductDetails } from './view-product-details';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

    const data = initialData.map(item => ({
        ...item,
        onToggle: () => handleRowToggle(item.id),
      }));

    const table = useReactTable({
        data,
        columns,
        state: {
            expanded: expandedRows,
        },
        onExpandedChange: setExpandedRows,
        meta,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        initialState: {
            pagination: {
                pageSize: 10,
            }
        }
    });

    const handleRowToggle = (rowId: number) => {
        setExpandedRows(prev => ({
          ...prev,
          [rowId]: !(prev as any)[rowId],
        }));
    };
    
    const closeRow = (rowId: number) => {
        setExpandedRows(prev => ({ ...prev, [rowId]: false }));
    }

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
                <Collapsible asChild key={row.id} open={row.getIsExpanded()}>
                    <>
                    <CollapsibleTrigger asChild>
                        <TableRow
                            data-state={row.getIsSelected() && "selected"}
                            onClick={() => row.toggleExpanded()}
                            className="cursor-pointer"
                        >
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                         <TableRow>
                            <TableCell colSpan={columns.length}>
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
                                            productGroups={meta.productGroups}
                                            taxes={meta.taxes}
                                            onClose={() => closeRow(row.original.id)}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </TableCell>
                        </TableRow>
                    </CollapsibleContent>
                    </>
                </Collapsible>
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
