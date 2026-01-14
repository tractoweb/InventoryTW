
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getProductDetails } from "@/actions/get-product-details";
import { updateProduct, UpdateProductInput } from "@/actions/update-product";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProductGroup } from "@/actions/get-product-groups";
import type { Tax } from "@/actions/get-taxes";

type EditProductFormProps = {
  productId: number | null;
  productGroups: ProductGroup[];
  taxes: Tax[];
  onClose: () => void;
};

const formSchema = z.object({
  id: z.number(),
  name: z.string().min(2, "El nombre es obligatorio."),
  code: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo.").optional(),
  measurementunit: z.string().min(1, "La posición es obligatoria."),
  isenabled: z.boolean(),
  productgroupid: z.coerce.number().min(1, "Debe seleccionar una categoría."),
  taxes: z.array(z.coerce.number()).optional(),
  reorderpoint: z.coerce.number().min(0).optional(),
  lowstockwarningquantity: z.coerce.number().min(0).optional(),
  islowstockwarningenabled: z.boolean(),
});


export function EditProductForm({ productId, productGroups, taxes, onClose }: EditProductFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      price: 0,
      cost: 0,
      measurementunit: "",
      isenabled: true,
      islowstockwarningenabled: true,
      taxes: [],
    },
  });

  useEffect(() => {
    if (productId) {
      setIsLoading(true);
      setError(null);
      getProductDetails(productId)
        .then(result => {
          if (result.error) {
            setError(result.error);
                    } else if ((result as any).data) {
                        const data: any = (result as any).data;
                                                const taxIds: number[] = Array.isArray(data.taxes)
                                                    ? data.taxes
                                                            .map((t: any) => Number(t?.taxId))
                                                            .filter((id: any) => Number.isFinite(id))
                                                    : (data.taxesText || data.taxes)
                                                            ? String(data.taxesText || data.taxes)
                                                                    .split(',')
                                                                    .map((taxName: string) => {
                                                                        const foundTax = taxes.find((t) => t.name.trim() === taxName.trim());
                                                                        return foundTax ? foundTax.id : null;
                                                                    })
                                                                    .filter((id: number | null) => id !== null) as number[]
                                                            : [];
            
            form.reset({
                                id: data.id,
                                name: data.name || "",
                                code: data.code || "",
                                description: data.description || "",
                                price: data.price || 0,
                                cost: data.cost || 0,
                                measurementunit: data.measurementunit || "",
                                isenabled: !!data.isenabled,
                                productgroupid: data.productgroupid || undefined,
                taxes: taxIds,
                                reorderpoint: data.reorderpoint ?? 0,
                                lowstockwarningquantity: data.lowstockwarningquantity ?? 0,
                                islowstockwarningenabled: !!data.islowstockwarningenabled,
            });
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [productId, form, taxes]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const result = await updateProduct(values as UpdateProductInput);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Producto Actualizado",
        description: result.message || "Los cambios se han guardado correctamente.",
      });
      onClose();
    } else {
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: result.error || "No se pudieron guardar los cambios.",
      });
    }
  }
  
  if (isLoading) {
    return (
        <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
        </div>
    );
  }

  if (error) {
    return (
        <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error al Cargar Datos</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
    );
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
                            <FormLabel>Nombre del Producto</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Teclado Inalámbrico" {...field} />
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
                                    <Input placeholder="Ej: SKU-12345" {...field} />
                                </FormControl>
                                <FormDescription>Este valor también se usará como código de barras.</FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <FormField
                        control={form.control}
                        name="productgroupid"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Categoría (Grupo)</FormLabel>
                                <Select onValueChange={field.onChange} value={String(field.value)}>
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
                     <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe el producto..." {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <div className="flex items-center space-x-8 pt-2">
                        <FormField
                            control={form.control}
                            name="isenabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <FormLabel className="pr-4">Habilitado</FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                </TabsContent>

                 <TabsContent value="price" className="space-y-4 pt-4">
                     <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Precio</FormLabel>
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
                                                {item.name}
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
                     <FormField
                        control={form.control}
                        name="measurementunit"
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
                    <div className="pt-4 space-y-4">
                        <FormField
                            control={form.control}
                            name="islowstockwarningenabled"
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
                            name="reorderpoint"
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
                            name="lowstockwarningquantity"
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
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onClose()}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Cambios"}</Button>
            </DialogFooter>
        </form>
    </Form>
  );
}
