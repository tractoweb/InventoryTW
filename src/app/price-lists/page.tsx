"use client";

import * as React from "react";
import Link from "next/link";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { useProductsCatalog } from "@/components/catalog/products-catalog-provider";
import type { ProductsMasterRow } from "@/actions/list-products-for-master";

type PriceRow = ProductsMasterRow & {
  marginPct: number | null;
};

function normalizeLoose(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function money(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function toCsv(rows: PriceRow[]): string {
  const header = ["ID", "Código", "Nombre", "Costo", "Precio", "Margen%", "Activo", "Actualizado"];
  const lines = rows.map((r) => [
    String(r.id),
    String(r.code ?? ""),
    String(r.name ?? ""),
    String(r.cost ?? ""),
    String(r.price ?? ""),
    r.marginPct === null ? "" : String(r.marginPct.toFixed(2)),
    r.isEnabled ? "1" : "0",
    String(r.updatedAt ?? ""),
  ]);

  const esc = (v: string) => {
    const s = String(v ?? "");
    if (/[\n\r\t,\"]/g.test(s)) return `"${s.replace(/\"/g, '""')}"`;
    return s;
  };

  return [header, ...lines].map((row) => row.map(esc).join(",")).join("\n");
}

export default function PriceListsPage() {
  const productsCatalog = useProductsCatalog();

  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 250);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [jumpTo, setJumpTo] = React.useState("");

  React.useEffect(() => {
    productsCatalog.ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: PriceRow[] = React.useMemo(() => {
    const base = (productsCatalog.products ?? []).map((p) => {
      const cost = p.cost !== null && p.cost !== undefined ? Number(p.cost) : null;
      const price = p.price !== null && p.price !== undefined ? Number(p.price) : null;
      const marginPct = cost && Number.isFinite(cost) && cost > 0 && price && Number.isFinite(price)
        ? ((price - cost) / cost) * 100
        : null;
      return { ...p, marginPct };
    });

    const term = normalizeLoose(dq);
    const raw = String(dq ?? "").trim();
    if (!term) return base;

    return base.filter((r) => {
      const idText = String(r.id);
      const code = normalizeLoose(r.code);
      const name = normalizeLoose(r.name);
      return idText.includes(raw) || code.includes(term) || name.includes(term);
    });
  }, [productsCatalog.products, dq]);

  const columns = React.useMemo<ColumnDef<PriceRow>[]>(
    () => [
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
        header: "Producto",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">
              <Link className="underline" href="/inventory">Abrir en Productos</Link>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "cost",
        header: () => <div className="text-right">Costo</div>,
        cell: ({ row }) => <div className="text-right font-medium">{money(row.original.cost)}</div>,
      },
      {
        accessorKey: "price",
        header: () => <div className="text-right">Precio</div>,
        cell: ({ row }) => <div className="text-right font-medium">{money(row.original.price)}</div>,
      },
      {
        accessorKey: "marginPct",
        header: () => <div className="text-right">Margen%</div>,
        cell: ({ row }) => (
          <div className="text-right">{row.original.marginPct === null ? "—" : `${row.original.marginPct.toFixed(2)}%`}</div>
        ),
        sortingFn: (a, b) => {
          const av = (a.original.marginPct ?? Number.NEGATIVE_INFINITY) as number;
          const bv = (b.original.marginPct ?? Number.NEGATIVE_INFINITY) as number;
          return av - bv;
        },
      },
      {
        accessorKey: "isEnabled",
        header: "Activo",
        cell: ({ row }) => <div className="text-center">{row.original.isEnabled ? "✓" : "—"}</div>,
      },
      {
        accessorKey: "updatedAt",
        header: "Actualizado",
        cell: ({ row }) => <div className="text-xs text-muted-foreground">{row.original.updatedAt ?? "—"}</div>,
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
    getRowId: (row) => String(row.id),
  });

  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Listas de precios</h1>
          <p className="text-muted-foreground">Vista tipo Aronium para revisar precios/costos y exportar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => productsCatalog.refresh()}
            disabled={productsCatalog.status === "loading"}
          >
            Refrescar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const csv = toCsv(rows);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `price-list-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={rows.length === 0}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtro</CardTitle>
          <CardDescription>Busca por ID, código o nombre. Ordena por cabezales.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" />
          <div className="text-xs text-muted-foreground">
            {productsCatalog.status === "loading" || productsCatalog.status === "idle"
              ? "Cargando catálogo…"
              : productsCatalog.status === "error"
                ? productsCatalog.error ?? "No se pudieron cargar productos"
                : `${rows.length} productos`}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sortDir = h.column.getIsSorted();
                  return (
                    <TableHead
                      key={h.id}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={canSort ? "select-none cursor-pointer" : undefined}
                      title={canSort ? "Ordenar" : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort ? (
                          <span className="text-xs text-muted-foreground">{sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : ""}</span>
                        ) : null}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No hay resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-end space-x-2 py-4 px-4">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Anterior
          </Button>
          <span className="text-sm">Página {currentPage} de {pageCount}</span>
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
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
