"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { PlusCircle, Wrench } from "lucide-react";
import { AddItemForm } from "./add-item-form";
import { AdjustStockForm } from "./adjust-stock-form";
import { ViewProductDetails } from "./view-product-details";
import { EditProductForm } from "./edit-product-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import type { StockInfo } from "@/lib/types";

type InventoryClientProps = {
  items: StockInfo[];
  pageType: "inventory" | "stock";
};

export function InventoryClient({ items, pageType }: InventoryClientProps) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  
  // State for modals
  const [viewedProductId, setViewedProductId] = useState<number | null>(null);
  const [editedProductId, setEditedProductId] = useState<number | null>(null);

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

  const tableMeta = {
    onView: (id: number) => setViewedProductId(id),
    onEdit: (id: number) => setEditedProductId(id),
  };

  const isStockPage = pageType === 'stock';

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
          
          <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button className="ml-auto">
                {isStockPage ? (
                  <Wrench className="mr-2 h-4 w-4" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                {isStockPage ? "Ajustar Stock" : "Añadir Artículo"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{isStockPage ? "Ajustar Stock de Producto" : "Añadir Nuevo Artículo"}</DialogTitle>
                <DialogDescription>
                  {isStockPage 
                    ? "Modifica la cantidad de un producto en un almacén específico." 
                    : "Completa los detalles para añadir un nuevo producto al inventario."
                  }
                </DialogDescription>
              </DialogHeader>
              {isStockPage ? <AdjustStockForm setOpen={setModalOpen} products={items} /> : <AddItemForm setOpen={setModalOpen} />}
            </DialogContent>
          </Dialog>
        </div>
        <DataTable columns={columns} data={filteredItems} meta={tableMeta} />
      </div>

      {/* Dialogs are now here, at the top level of the client component */}
      <ViewProductDetails
          productId={viewedProductId}
          isOpen={viewedProductId !== null}
          onClose={() => setViewedProductId(null)}
      />

      <EditProductForm
          productId={editedProductId}
          isOpen={editedProductId !== null}
          onClose={() => setEditedProductId(null)}
      />
    </>
  );
}
