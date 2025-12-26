"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { PlusCircle } from "lucide-react";
import { AddItemForm } from "./add-item-form";
import { ViewProductDetails } from "./view-product-details";
import { EditProductForm } from "./edit-product-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ProductInventory } from "@/lib/types";


export function InventoryClient({ items }: { items: ProductInventory[] }) {
  const [search, setSearch] = useState("");
  const [isAddOpen, setAddOpen] = useState(false);
  
  // State for modals
  const [viewedProductId, setViewedProductId] = useState<number | null>(null);
  const [editedProductId, setEditedProductId] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const searchLower = search.toLowerCase();
      const name = item.name || '';
      const code = item.code || '';
      
      return name.toLowerCase().includes(searchLower) ||
             code.toLowerCase().includes(searchLower);
    });
  }, [items, search]);

  const tableMeta = {
    onView: (id: number) => setViewedProductId(id),
    onEdit: (id: number) => setEditedProductId(id),
  };


  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por nombre, código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          
          <Dialog open={isAddOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="ml-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Artículo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Añadir Nuevo Artículo</DialogTitle>
              </DialogHeader>
              <AddItemForm setOpen={setAddOpen} />
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
