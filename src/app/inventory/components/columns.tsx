"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { InventoryItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const columns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.name}</div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge
          variant={
            status === "In Stock"
              ? "default"
              : status === "Low Stock"
              ? "secondary"
              : "destructive"
          }
          className={cn(
             status === 'In Stock' && 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
             status === 'Low Stock' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
             status === 'Out of Stock' && 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
          )}
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => (
      <div className="text-center">{row.original.quantity}</div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
  },
  {
    accessorKey: "manufacturer",
    header: "Manufacturer",
  },
  {
    accessorKey: "dateAdded",
    header: "Date Added",
    cell: ({ row }) => (
      <div>{format(new Date(row.original.dateAdded), "MMM d, yyyy")}</div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(item.id)}
            >
              Copy item ID
            </DropdownMenuItem>
            <DropdownMenuItem>Edit item</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Delete item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
