
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import type { StockInfo } from "@/lib/types";
import type { ProductGroup } from "@/actions/get-product-groups";
import type { Warehouse } from "@/actions/get-warehouses";
import type { Tax } from "@/actions/get-taxes";
import { AddProductForm } from "./add-product-form";
import { AdjustStockForm } from "./adjust-stock-form";
import { useToast } from "@/hooks/use-toast";
import { deleteProduct } from "@/actions/delete-product";
import { CameraScannerDialog } from "@/components/print-labels/camera-scanner-dialog";
import { ScanLine } from "lucide-react";


type InventoryClientProps = {
  items: StockInfo[];
  productGroups: ProductGroup[];
  warehouses: Warehouse[];
  taxes: Tax[];
  initialSearch?: string;
  pageType: "inventory" | "stock";
};

export function InventoryClient({ items: initialItems, productGroups, warehouses, taxes, initialSearch, pageType }: InventoryClientProps) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState(String(initialSearch ?? ""));
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const normalizeLoose = useCallback((value: unknown): string => {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  }, []);
  
  const filteredItems = useMemo(() => {
    if (!items) return [];
    const q = normalizeLoose(search);
    if (!q) return items;

    return items.filter((item) => {
      const idText = String((item as any)?.id ?? "");
      const name = normalizeLoose(item.name);
      const code = normalizeLoose(item.code);
      const warehouse = normalizeLoose((item as any)?.warehousename);
      const idx = normalizeLoose((item as any)?.searchindex);
      const barcodes = Array.isArray((item as any)?.barcodes)
        ? normalizeLoose(((item as any).barcodes as any[]).join(" "))
        : "";

      const hay = `${idText} ${name} ${code} ${warehouse} ${idx} ${barcodes}`;
      return hay.includes(q);
    });
  }, [items, search, normalizeLoose]);

  const handleDeleteProduct = useCallback(async (productId: number) => {
    const result = await deleteProduct(productId);
    if (result.success) {
        toast({
            title: "Producto Eliminado",
            description: result.message,
        });
        setItems(prevItems => prevItems.filter(item => item.id !== productId));
    } else {
        toast({
            variant: "destructive",
            title: "Error al eliminar",
            description: result.error,
        });
    }
  }, [toast]);


  const tableMeta = useMemo(() => ({
    productGroups,
    warehouses,
    taxes,
    handleDeleteProduct,
    pageType,
  }), [productGroups, warehouses, taxes, handleDeleteProduct]);

  const isStockPage = pageType === 'stock';
  
  const uniqueProductsForAdjust = Array.from(new Map(items.map(p => [p.id, p])).values());

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por nombre, código, almacén..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => setScanOpen(true)}
            title="Escanear código de barras"
          >
            <ScanLine className="h-4 w-4 mr-2" />
            Escanear
          </Button>

          {!isStockPage ? (
            <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
              <DialogTrigger asChild>
                <Button className="ml-auto">Añadir Producto</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Añadir Nuevo Producto</DialogTitle>
                  <DialogDescription>
                    Completa los detalles para añadir un nuevo producto al catálogo.
                  </DialogDescription>
                </DialogHeader>
                <AddProductForm
                  setOpen={setAddModalOpen}
                  productGroups={productGroups || []}
                  warehouses={warehouses}
                  taxes={taxes}
                />
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        <DataTable columns={columns} data={filteredItems} meta={tableMeta} />
      </div>

      <CameraScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetected={(value) => {
          const raw = String(value ?? "").trim();
          if (!raw) return;
          setScanOpen(false);
          setSearch(raw);
          toast({
            title: "Código detectado",
            description: raw,
          });
        }}
      />
    </>
  );
}
