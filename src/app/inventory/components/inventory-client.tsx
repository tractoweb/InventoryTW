"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { AddProductForm } from "./add-product-form";
import { AdjustStockForm } from "./adjust-stock-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import type { StockInfo } from "@/lib/types";
import type { ProductGroup } from "@/actions/get-product-groups";
import type { Warehouse } from "@/actions/get-warehouses";
import type { Tax } from "@/actions/get-taxes";

type InventoryClientProps = {
  items: StockInfo[];
  productGroups: ProductGroup[];
  warehouses: Warehouse[];
  taxes: Tax[];
  pageType: "inventory" | "stock";
};

export function InventoryClient({ items, productGroups, warehouses, taxes, pageType }: InventoryClientProps) {
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  
  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const searchLower = search.toLowerCase();
      const name = item.name || '';
      const code = item.code || '';
      const warehouse = item.warehousename || '';
      
      return name.toLowerCase().includes(searchLower) ||
             code.toLowerCase().includes(searchLower) ||
             warehouse.toLowerCase().includes(searchLower);
    });
  }, [items, search]);

  const tableMeta = useMemo(() => ({
    productGroups,
    warehouses,
    taxes,
  }), [productGroups, warehouses, taxes]);

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
          
          <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="ml-auto">
                {isStockPage ? "Ajustar Stock" : "Añadir Producto"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isStockPage ? "Ajustar Stock de Producto" : "Añadir Nuevo Producto"}</DialogTitle>
                <DialogDescription>
                  {isStockPage 
                    ? "Modifica la cantidad de un producto en un almacén específico." 
                    : "Completa los detalles para añadir un nuevo producto al catálogo."
                  }
                </DialogDescription>
              </DialogHeader>
              {isStockPage ? <AdjustStockForm setOpen={setAddModalOpen} products={uniqueProductsForAdjust} warehouses={warehouses} /> : <AddProductForm setOpen={setAddModalOpen} productGroups={productGroups || []} warehouses={warehouses} taxes={taxes} />}
            </DialogContent>
          </Dialog>
        </div>
        <DataTable columns={columns} data={filteredItems} meta={tableMeta} />
      </div>
    </>
  );
}
