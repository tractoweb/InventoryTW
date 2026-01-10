"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adjustStock } from "@/actions/adjust-stock";
import { StockInfo } from "@/lib/types";
import { Warehouse } from "@/actions/get-warehouses";

const formSchema = z.object({
  productId: z.coerce.number().min(1, "Debes seleccionar un producto."),
  warehouseId: z.coerce.number().min(1, "Debes seleccionar un almacén."),
  quantity: z.coerce.number().min(0, "La cantidad no puede ser negativa."),
});


type AdjustStockFormProps = {
  setOpen: (open: boolean) => void;
  products: StockInfo[];
  warehouses: Warehouse[];
};

export function AdjustStockForm({ setOpen, products, warehouses }: AdjustStockFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 0,
    },
  });

  // Unique products for the dropdown
  const uniqueProducts = Array.from(new Map(products.map(p => [p.id, p])).values());

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const result = await adjustStock(values);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Ajuste de Stock Exitoso",
        description: result.message || "El stock ha sido actualizado.",
      });
      setOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "Error en el ajuste",
        description: result.error || "No se pudo ajustar el stock.",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="productId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Producto</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={String(field.value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {uniqueProducts.map(product => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="warehouseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Almacén</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un almacén" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {warehouses.map(wh => (
                        <SelectItem key={wh.id} value={String(wh.id)}>
                            {wh.name}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nueva Cantidad de Stock</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Ej: 100" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar Ajuste"}
        </Button>
      </form>
    </Form>
  );
}
