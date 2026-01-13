
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { addProduct } from "@/actions/add-product";
import type { ProductGroup } from "@/actions/get-product-groups";
import type { Warehouse } from "@/actions/get-warehouses";
import type { Tax } from "@/actions/get-taxes";
import { useDebounce } from "@/hooks/use-debounce";
import { checkReferenceExistence } from "@/actions/check-reference-existence";


const formSchema = z.object({
  name: z.string().min(2, "El nombre del producto es obligatorio."),
  code: z.string().optional(),
  measurementUnit: z.string().min(1, "La posición es obligatoria."),
  productGroupId: z.coerce.number().min(1, "Debe seleccionar una categoría."),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  isUsingDefaultQuantity: z.boolean().default(true),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo.").optional(),
  isTaxInclusivePrice: z.boolean().default(true),
  taxes: z.array(z.coerce.number()).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  lowStockWarningQuantity: z.coerce.number().min(0).optional(),
  isLowStockWarningEnabled: z.boolean().default(true),
  initialQuantity: z.coerce.number().min(0).optional(),
  warehouseId: z.coerce.number().optional(),
}).refine(data => {
    if (data.initialQuantity && data.initialQuantity > 0) {
        return !!data.warehouseId;
    }
    return true;
}, {
    message: "Debe seleccionar un almacén si ingresa una cantidad inicial.",
    path: ["warehouseId"],
});


type AddProductFormProps = {
  setOpen: (open: boolean) => void;
  productGroups: ProductGroup[];
  warehouses: Warehouse[];
  taxes: Tax[];
};

export function AddProductForm({ setOpen, productGroups, warehouses, taxes }: AddProductFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      measurementUnit: "",
      productGroupId: undefined,
      description: "",
      isEnabled: true,
      isUsingDefaultQuantity: true,
      price: 0,
      cost: 0,
      isTaxInclusivePrice: true,
      taxes: [],
      reorderPoint: 0,
      lowStockWarningQuantity: 0,
      isLowStockWarningEnabled: true,
      initialQuantity: 0,
    },
  });

  const codeValue = form.watch("code");
  const debouncedCode = useDebounce(codeValue, 500);

  useEffect(() => {
    if (debouncedCode && debouncedCode.length > 0) {
      setIsCheckingCode(true);
      checkReferenceExistence(debouncedCode).then(result => {
        setIsCheckingCode(false);
        if (result.exists) {
          form.setError("code", {
            type: "manual",
            message: "Esta referencia ya está en uso.",
          });
        } else {
          form.clearErrors("code");
        }
      });
    } else {
        form.clearErrors("code");
    }
  }, [debouncedCode, form]);


  const getSelectedTaxRate = useCallback(() => {
    const selectedTaxIds = form.getValues('taxes') || [];
    const totalRate = selectedTaxIds.reduce((acc, taxId) => {
      const tax = taxes.find(t => t.id === taxId);
      return acc + (tax ? tax.rate / 100 : 0);
    }, 0);
    return totalRate;
  }, [form, taxes]);
  
  const calculatePrice = useCallback((cost: number, taxRate: number) => {
    if (cost <= 0) return 0;
    const newPrice = cost * (1 + taxRate);
    return parseFloat(newPrice.toFixed(2));
  }, []);

  const calculateCost = useCallback((price: number, taxRate: number, isTaxInclusive: boolean) => {
    if (price <= 0) return 0;
    const newCost = isTaxInclusive ? price / (1 + taxRate) : price;
    return parseFloat(newCost.toFixed(2));
  }, []);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      const taxRate = getSelectedTaxRate();
      const isTaxInclusive = form.getValues('isTaxInclusivePrice');

      if (name === 'cost' || name?.startsWith('taxes')) {
        const cost = Number(form.getValues('cost')) || 0;
        const newPrice = calculatePrice(cost, taxRate);
        const currentPrice = Number(form.getValues('price')) || 0;

        if (newPrice.toFixed(2) !== currentPrice.toFixed(2)) {
          form.setValue('price', newPrice, { shouldValidate: true });
        }
      }

      if (name === 'price' || name === 'isTaxInclusivePrice') {
        const price = Number(form.getValues('price')) || 0;
        const newCost = calculateCost(price, taxRate, isTaxInclusive);
        const currentCost = Number(form.getValues('cost')) || 0;
        
        if (newCost.toFixed(2) !== currentCost.toFixed(2)) {
          form.setValue('cost', newCost, { shouldValidate: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, getSelectedTaxRate, calculatePrice, calculateCost]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const result = await addProduct(values);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Producto Creado",
        description: result.message || "El producto ha sido añadido al inventario.",
      });
      setOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "Error al crear el producto",
        description: result.error || "No se pudo añadir el producto.",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="price">Precio e Impuestos</TabsTrigger>
            <TabsTrigger value="stock">Control de Stock</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4 pt-4">
             <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                        <Input placeholder="Nombre del producto" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            <div className="grid grid-cols-1 gap-4">
                <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Código / Referencia</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                         <FormDescription>
                            {isCheckingCode ? "Verificando..." : "Este valor también se usará como código de barras."}
                         </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="measurementUnit"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Posición en Almacén</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: Pasillo A, Estante 3" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="productGroupId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Categoría (Grupo)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {productGroups.map(group => (
                                    <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="space-y-3 pt-2">
                <FormField
                    control={form.control}
                    name="isEnabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <FormLabel>Activo</FormLabel>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="isUsingDefaultQuantity"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <FormLabel>Cantidad por defecto (1)</FormLabel>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        </FormItem>
                    )}
                />
            </div>
            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Breve descripción del producto..." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
          </TabsContent>

          <TabsContent value="price" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Precio de Venta</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Costo</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              </div>
               <FormField
                    control={form.control}
                    name="isTaxInclusivePrice"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>El precio de venta incluye los impuestos</FormLabel>
                            <FormDescription>
                                Si se marca, el costo se calculará restando los impuestos al precio.
                            </FormDescription>
                        </div>
                        </FormItem>
                    )}
                />
              <div>
                <FormLabel>Impuestos Aplicables</FormLabel>
                <FormField
                    control={form.control}
                    name="taxes"
                    render={() => (
                        <FormItem>
                            {taxes.map((item) => (
                                <FormField
                                key={item.id}
                                control={form.control}
                                name="taxes"
                                render={({ field }) => {
                                    return (
                                    <FormItem
                                        key={item.id}
                                        className="flex flex-row items-start space-x-3 space-y-0 mt-2"
                                    >
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(item.id)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...(field.value || []), item.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                    (value) => value !== item.id
                                                    )
                                                );
                                            }}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                        {item.name} ({item.rate}%)
                                        </FormLabel>
                                    </FormItem>
                                    );
                                }}
                                />
                            ))}
                            <FormMessage />
                        </FormItem>
                    )}
                />
              </div>
          </TabsContent>

          <TabsContent value="stock" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="initialQuantity"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Cantidad Inicial</FormLabel>
                        <FormControl>
                            <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Cantidad con la que ingresa el producto.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="warehouseId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Almacén de Ingreso</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Selecciona un almacén" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {warehouses.map(wh => (
                                  <SelectItem key={wh.idWarehouse} value={String(wh.idWarehouse)}>{wh.name}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="pt-4 space-y-4">
                <FormField
                    control={form.control}
                    name="isLowStockWarningEnabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <FormLabel>Habilitar alerta de stock bajo</FormLabel>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="reorderPoint"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Punto de Reorden</FormLabel>
                        <FormControl>
                            <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Cantidad mínima antes de necesitar reabastecimiento.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="lowStockWarningQuantity"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Cantidad para Alerta de Stock Bajo</FormLabel>
                        <FormControl>
                            <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Se activará una alerta cuando el stock llegue a esta cantidad.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || form.formState.isSubmitting || isCheckingCode || !!form.formState.errors.code}>
              {isSubmitting ? "Guardando..." : "Guardar Producto"}
            </Button>
        </div>
      </form>
    </Form>
  );
}
