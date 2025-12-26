"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getProductDetails } from "@/actions/get-product-details";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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

type EditProductFormProps = {
  productId: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

// Simplified schema for display purposes
const formSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio."),
  code: z.string().optional(),
  plu: z.coerce.number().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  measurementunit: z.string().optional(),
  isenabled: z.boolean(),
  isservice: z.boolean(),
});

export function EditProductForm({ productId, isOpen, setOpen }: EditProductFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        name: "",
        code: "",
        plu: 0,
        description: "",
        price: 0,
        cost: 0,
        measurementunit: "",
        isenabled: true,
        isservice: false,
    },
  });

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      getProductDetails(productId)
        .then(result => {
          if (result.error) {
            setError(result.error);
          } else if (result.data) {
            // Reset form with fetched data
            form.reset({
                name: result.data.name || "",
                code: result.data.code || "",
                plu: result.data.plu || 0,
                description: result.data.description || "",
                price: result.data.price || 0,
                cost: result.data.cost || 0,
                measurementunit: result.data.measurementunit || "",
                isenabled: !!result.data.isenabled,
                isservice: !!result.data.isservice,
            });
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, productId, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Form values to be submitted:", values);
    // Here you would call an `updateProduct` server action
    toast({
      title: "Función no implementada",
      description: "La lógica para guardar los cambios aún no se ha añadido.",
      variant: "destructive"
    });
    // setOpen(false); // Keep open for demonstration
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
          <DialogDescription>
            Modifica la información del producto. Haz clic en Guardar para aplicar los cambios.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && (
            <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        )}

        {error && !isLoading && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error al Cargar Datos</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {!isLoading && !error && (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                         <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Código / Referencia</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ej: SKU-12345" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <FormField
                            control={form.control}
                            name="measurementunit"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Unidad de Medida</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ej: unidad, kg, lt" {...field} />
                                </FormControl>
                                <FormMessage />
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
                                <Textarea placeholder="Describe el producto..." {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <div className="flex items-center space-x-8">
                        <FormField
                            control={form.control}
                            name="isenabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5 mr-4">
                                        <FormLabel>Habilitado</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="isservice"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5 mr-4">
                                        <FormLabel>Es un Servicio</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button type="submit">Guardar Cambios</Button>
                    </DialogFooter>
                </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
