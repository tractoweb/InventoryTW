"use client";

import { useState, useMemo } from "react";
import type { InventoryItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { PlusCircle, ListFilter } from "lucide-react";
import { AddItemForm } from "./add-item-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Category = InventoryItem["category"];
type Status = InventoryItem["status"];

const allCategories: Category[] = [
  "Electronics",
  "Furniture",
  "Office Supplies",
  "Software",
];
const allStatuses: Status[] = ["In Stock", "Low Stock", "Out of Stock"];

export function InventoryClient({ items }: { items: InventoryItem[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<Set<Category>>(new Set());
  const [statusFilters, setStatusFilters] = useState<Set<Status>>(new Set());
  const [isAddOpen, setAddOpen] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(searchLower) ||
        item.manufacturer.toLowerCase().includes(searchLower) ||
        item.id.toLowerCase().includes(searchLower);

      const matchesCategory =
        categoryFilters.size === 0 || categoryFilters.has(item.category);

      const matchesStatus =
        statusFilters.size === 0 || statusFilters.has(item.status);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilters, statusFilters]);

  const toggleFilter = (
    type: "category" | "status",
    value: Category | Status
  ) => {
    const set = type === "category" ? setCategoryFilters : setStatusFilters;
    const currentFilters = new Set(
      type === "category" ? categoryFilters : statusFilters
    );

    if (currentFilters.has(value as any)) {
      currentFilters.delete(value as any);
    } else {
      currentFilters.add(value as any);
    }
    set(currentFilters as any);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by name, manufacturer, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <ListFilter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allCategories.map((category) => (
              <DropdownMenuCheckboxItem
                key={category}
                checked={categoryFilters.has(category)}
                onCheckedChange={() => toggleFilter("category", category)}
              >
                {category}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allStatuses.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={statusFilters.has(status)}
                onCheckedChange={() => toggleFilter("status", status)}
              >
                {status}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={isAddOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
            </DialogHeader>
            <AddItemForm setOpen={setAddOpen} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={filteredItems} />
    </div>
  );
}
