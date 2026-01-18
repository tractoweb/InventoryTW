"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";

import type { ProductGroup } from "@/actions/get-product-groups";
import type { Warehouse } from "@/actions/get-warehouses";
import type { Tax } from "@/actions/get-taxes";

import type { ProductsMasterRow } from "@/actions/list-products-for-master";
import { useProductsCatalog } from "@/components/catalog/products-catalog-provider";
import { listProductsByGroup, type ProductTreeItem } from "@/actions/list-products-by-group";

import { DataTable } from "./data-table";
import { productsMasterColumns } from "./products-master-columns";
import { AddProductForm } from "./add-product-form";
import { deleteProduct } from "@/actions/delete-product";
import { ViewProductDetails } from "./view-product-details";
import { EditProductForm } from "./edit-product-form";
import { CameraScannerDialog } from "@/components/print-labels/camera-scanner-dialog";
import { findProductByBarcodeAction } from "@/actions/find-product-by-barcode";
import { ScanLine } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ProductsMasterTableRow = ProductsMasterRow & {
  productGroupName?: string | null;
};

type Props = {
  productGroups: ProductGroup[];
  warehouses: Warehouse[];
  taxes: Tax[];
  currentUserName: string;
  initialQuery?: string;
  initialGroupId?: number | null;
};

export function ProductsMasterClient({ productGroups, warehouses, taxes, currentUserName, initialQuery, initialGroupId }: Props) {
  const { toast } = useToast();

  const productsCatalog = useProductsCatalog();

  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(
    typeof initialGroupId === "number" && Number.isFinite(initialGroupId) ? initialGroupId : null
  );

  const [leftQuery, setLeftQuery] = React.useState("");
  const dLeftQuery = useDebounce(leftQuery, 200);
  const [openByGroupId, setOpenByGroupId] = React.useState<Record<number, boolean>>({});
  const [groupProducts, setGroupProducts] = React.useState<Record<number, ProductTreeItem[]>>({});
  const [loadingGroupIds, setLoadingGroupIds] = React.useState<Record<number, boolean>>({});

  const [query, setQuery] = React.useState(String(initialQuery ?? ""));
  const dQuery = useDebounce(query, 250);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ProductsMasterTableRow[]>([]);
  const [isAddModalOpen, setAddModalOpen] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsProductId, setDetailsProductId] = React.useState<number | null>(null);

  const [groupsOpen, setGroupsOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);

  const groupNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const g of productGroups ?? []) {
      if (!Number.isFinite(Number(g.id))) continue;
      map.set(Number(g.id), String(g.name ?? ""));
    }
    return map;
  }, [productGroups]);

  function normalizeLoose(value: unknown): string {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  }

  React.useEffect(() => {
    // Ensure catalog is loaded once; UI will react when provider state updates.
    productsCatalog.ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (productsCatalog.status === "error") {
      setError(productsCatalog.error ?? "No se pudieron cargar productos");
      setLoading(false);
      return;
    }

    if (productsCatalog.status === "loading" || productsCatalog.status === "idle") {
      setLoading(true);
      return;
    }

    // ready
    setError(null);
    const base = (productsCatalog.products ?? []).map((r: ProductsMasterRow) => ({
      ...(r as ProductsMasterTableRow),
      productGroupName:
        r.productGroupId && groupNameById.has(Number(r.productGroupId))
          ? groupNameById.get(Number(r.productGroupId))
          : null,
    })) as ProductsMasterTableRow[];
    setRows(base);
    setLoading(false);
  }, [productsCatalog.status, productsCatalog.error, productsCatalog.products, groupNameById, refreshNonce]);

  const rootGroups = React.useMemo(() => {
    const all = productGroups ?? [];
    const childrenByParent = new Map<number | null, ProductGroup[]>();

    for (const g of all) {
      const parent = (g as any).parentGroupId ?? null;
      const parentId = parent === null || parent === undefined ? null : Number(parent);
      const key = Number.isFinite(parentId as any) ? (parentId as number) : null;
      const arr = childrenByParent.get(key) ?? [];
      arr.push(g);
      childrenByParent.set(key, arr);
    }

    const sortGroups = (arr: ProductGroup[]) => arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    for (const [k, v] of childrenByParent) childrenByParent.set(k, sortGroups(v));

    return {
      childrenByParent,
      roots: childrenByParent.get(null) ?? [],
    };
  }, [productGroups]);

  const filteredRoots = React.useMemo(() => {
    const q = String(dLeftQuery ?? "").trim().toLowerCase();
    if (!q) return rootGroups.roots;
    return rootGroups.roots.filter((g) => String(g.name ?? "").toLowerCase().includes(q) || String(g.id).includes(q));
  }, [rootGroups.roots, dLeftQuery]);

  const filteredRows = React.useMemo(() => {
    const q = normalizeLoose(dQuery);
    const qRaw = String(dQuery ?? "").trim();
    const hasQuery = q.length > 0;

    return (rows ?? []).filter((r) => {
      if (selectedGroupId && r.productGroupId !== selectedGroupId) return false;
      if (!hasQuery) return true;

      const idText = String(r.id);
      const name = normalizeLoose(r.name);
      const code = normalizeLoose(r.code);
      return idText.includes(qRaw) || name.includes(q) || code.includes(q);
    });
  }, [rows, selectedGroupId, dQuery]);

  async function ensureGroupLoaded(groupId: number) {
    if (groupProducts[groupId]) return;
    setLoadingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await listProductsByGroup({ groupId, q: "", limit: 200 });
      if (res.error) throw new Error(res.error);
      setGroupProducts((prev) => ({ ...prev, [groupId]: res.data ?? [] }));
    } catch {
      setGroupProducts((prev) => ({ ...prev, [groupId]: [] }));
    } finally {
      setLoadingGroupIds((prev) => ({ ...prev, [groupId]: false }));
    }
  }

  async function setGroupOpen(groupId: number, open: boolean) {
    setOpenByGroupId((prev) => ({ ...prev, [groupId]: open }));
    if (open) {
      await ensureGroupLoaded(groupId);
    }
  }

  const handleDeleteProduct = React.useCallback(
    async (productId: number) => {
      const target = (rows ?? []).find((r) => r.id === productId);
      const result = await deleteProduct(productId);
      if (result.success) {
        const when = new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date());
        const whatName = target?.name ? String(target.name) : `Producto #${productId}`;
        const whatRef = target?.code ? String(target.code) : String(productId);
        toast({
          title: "Producto desactivado",
          description: `${currentUserName} · ${when} · ${whatName} (${whatRef})`,
        });
        setRows((prev) => prev.filter((r) => r.id !== productId));
        setGroupProducts((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            const gid = Number(key);
            next[gid] = (next[gid] ?? []).filter((p) => p.idProduct !== productId);
          }
          return next;
        });
      } else {
        toast({ variant: "destructive", title: "Error al eliminar", description: result.error });
      }
    },
    [toast, currentUserName, rows]
  );

  const tableMeta = React.useMemo(
    () => ({
      productGroups,
      warehouses,
      taxes,
      handleDeleteProduct,
      disableRowExpansion: true,
      openProductDetails: (productId: number) => {
        setDetailsProductId(Number(productId));
        setDetailsOpen(true);
      },
    }),
    [productGroups, warehouses, taxes, handleDeleteProduct]
  );

  function GroupNode({ group, depth }: { group: ProductGroup; depth: number }) {
    const groupId = group.id;
    const children = rootGroups.childrenByParent.get(groupId) ?? [];
    const loaded = groupProducts[groupId] ?? null;
    const loadingGp = Boolean(loadingGroupIds[groupId]);
    const isOpen = Boolean(openByGroupId[groupId]);

    const displayProducts = React.useMemo(() => {
      const q = String(dLeftQuery ?? "").trim().toLowerCase();
      if (!loaded) return [];
      if (!q) return loaded;
      return loaded.filter((p) => p.name.toLowerCase().includes(q) || String(p.idProduct).includes(q) || String(p.code ?? "").toLowerCase().includes(q));
    }, [loaded, dLeftQuery]);

    return (
      <Collapsible open={isOpen} onOpenChange={(open) => setGroupOpen(groupId, open)}>
        <div className="flex items-center justify-between gap-2" style={{ paddingLeft: depth * 10 }}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
              title={group.name}
            >
              <span className="truncate">{group.name}</span>
            </button>
          </CollapsibleTrigger>
          <Badge
            variant={selectedGroupId === groupId ? "default" : "secondary"}
            className="shrink-0 cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedGroupId((prev) => (prev === groupId ? null : groupId));
            }}
          >
            {selectedGroupId === groupId ? "Filtrando" : "Filtrar"}
          </Badge>
        </div>

        <CollapsibleContent>
          <div className="mt-1 space-y-1">
            {loadingGp ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">Cargando…</div>
            ) : loaded ? (
              displayProducts.length ? (
                displayProducts.slice(0, 200).map((p) => (
                  <button
                    key={p.idProduct}
                    type="button"
                    className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setDetailsProductId(p.idProduct);
                      setDetailsOpen(true);
                    }}
                    title={p.code ? `${p.code} — ${p.name}` : p.name}
                  >
                    <div className="truncate">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{p.code ?? p.idProduct}</span>
                      {p.name}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-2 py-1 text-xs text-muted-foreground">Sin productos.</div>
              )
            ) : (
              <div className="px-2 py-1 text-xs text-muted-foreground">Expandir para cargar productos.</div>
            )}
          </div>

          {children.length ? (
            <div className="mt-2 space-y-2">
              {children.map((c) => (
                <GroupNode key={c.id} group={c} depth={depth + 1} />
              ))}
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <Sheet open={groupsOpen} onOpenChange={setGroupsOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Grupos y productos</SheetTitle>
          </SheetHeader>
          <div className="pt-4">
            <Input placeholder="Buscar en el árbol…" value={leftQuery} onChange={(e) => setLeftQuery(e.target.value)} />
            <div className="mt-4">
              <ScrollArea className="h-[calc(100svh-220px)] pr-2">
                <div className="space-y-2">
                  {filteredRoots.map((g) => (
                    <GroupNode key={g.id} group={g} depth={0} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setGroupsOpen(true)}>
            Grupos
          </Button>
          <Input
            placeholder="Buscar productos (nombre, código o barcode)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-[420px] min-w-0"
          />

          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setScanOpen(true)}
            title="Escanear código de barras"
          >
            <ScanLine className="h-4 w-4 mr-2" />
            Escanear
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                await productsCatalog.refresh();
                setRefreshNonce((n) => n + 1);
              } catch (e: any) {
                setError(e?.message ?? "No se pudo refrescar");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            title="Refrescar"
          >
            Refrescar
          </Button>

          {selectedGroupId ? (
            <Button variant="outline" onClick={() => setSelectedGroupId(null)} disabled={loading}>
              Quitar filtro: {productGroups.find((g) => g.id === selectedGroupId)?.name ?? `#${selectedGroupId}`}
            </Button>
          ) : null}
        </div>

        <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
          <DialogTrigger asChild>
            <Button>Nuevo producto</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Añadir nuevo producto</DialogTitle>
              <DialogDescription>Completa los detalles para añadir un nuevo producto al catálogo.</DialogDescription>
            </DialogHeader>
              <AddProductForm
                setOpen={setAddModalOpen}
                productGroups={productGroups || []}
                warehouses={warehouses}
                taxes={taxes}
                currentUserName={currentUserName}
              />
          </DialogContent>
        </Dialog>
      </div>

      <div className="text-sm text-muted-foreground text-center">
        Productos: {filteredRows.length} {selectedGroupId ? "(filtrado por grupo)" : ""}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <div className="w-full min-w-0">
          <DataTable columns={productsMasterColumns} data={filteredRows} meta={tableMeta} />
        </div>
      )}

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalles del producto</SheetTitle>
          </SheetHeader>
          {detailsProductId ? (
            <div className="pt-4">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="mb-4 grid w-full grid-cols-2">
                  <TabsTrigger value="details">Detalles</TabsTrigger>
                  <TabsTrigger value="edit">Editar</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <ViewProductDetails productId={detailsProductId} />
                </TabsContent>
                <TabsContent value="edit">
                  <EditProductForm
                    productId={detailsProductId}
                    productGroups={productGroups}
                    taxes={taxes}
                    currentUserName={currentUserName}
                    onClose={() => setDetailsOpen(false)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="pt-4 text-sm text-muted-foreground">Selecciona un producto.</div>
          )}
        </SheetContent>
      </Sheet>

      <CameraScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetected={(value) => {
          const raw = String(value ?? "").trim();
          if (!raw) return;
          setScanOpen(false);
          setQuery(raw);

          void (async () => {
            const res = await findProductByBarcodeAction(raw);
            if (res?.data?.idProduct) {
              setDetailsProductId(Number(res.data.idProduct));
              setDetailsOpen(true);
              return;
            }

            toast({
              variant: "destructive",
              title: "No encontrado",
              description: res?.error ?? "No se encontró producto para ese código",
            });
          })();
        }}
      />
    </div>
  );
}
