
"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
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
    currentUserName?: string;
  onClose: () => void;
};

function parseMoneyIntOptional(input: unknown): number | undefined {
    const raw = String(input ?? "").trim();
    if (!raw) return undefined;
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) return undefined;
    const n = Number.parseInt(digits, 10);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, n);
}

function formatMoneyInt(value: unknown): string {
    const n = Math.trunc(Number(value ?? 0));
    const safe = Number.isFinite(n) ? Math.max(0, n) : 0;
    try {
        return new Intl.NumberFormat("es-CO", {
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
        }).format(safe);
    } catch {
        return String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
}

function roundMoneyInt(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
}

const formSchema = z.object({
  id: z.number(),
  name: z.string().min(2, "El nombre es obligatorio."),
  code: z.string().optional(),
  description: z.string().optional(),
    price: z.preprocess(parseMoneyIntOptional, z.number().int().min(1, "El precio debe ser mayor a 0.")),
    cost: z.preprocess(parseMoneyIntOptional, z.number().int().min(1, "El costo debe ser mayor a 0.")),
    markup: z.coerce.number().min(0, "El margen no puede ser negativo.").default(40),
    isTaxInclusivePrice: z.boolean().default(true),
  measurementunit: z.string().min(1, "La posición es obligatoria."),
  isenabled: z.boolean(),
  productgroupid: z.coerce.number().min(1, "Debe seleccionar una categoría."),
  taxes: z.array(z.coerce.number()).optional(),
  reorderpoint: z.coerce.number().min(0).optional(),
  lowstockwarningquantity: z.coerce.number().min(0).optional(),
  islowstockwarningenabled: z.boolean(),
});


export function EditProductForm({ productId, productGroups, taxes, currentUserName, onClose }: EditProductFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
    const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const loadedProductIdRef = useRef<number | null>(null);
    const pendingTaxNamesRef = useRef<string[] | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
            price: undefined,
            cost: undefined,
            markup: 40,
            isTaxInclusivePrice: true,
      measurementunit: "",
      isenabled: true,
      islowstockwarningenabled: true,
      taxes: [],
    },
  });

    // Track what the user last edited to avoid cost<->price feedback loops.
    const [lastEdited, setLastEdited] = useState<"cost" | "price">("cost");

    const wCost = useWatch({ control: form.control, name: "cost" });
    const wPrice = useWatch({ control: form.control, name: "price" });
    const wMarkup = useWatch({ control: form.control, name: "markup" });
    const wTaxes = useWatch({ control: form.control, name: "taxes" });
    const wIsTaxInclusivePrice = useWatch({ control: form.control, name: "isTaxInclusivePrice" });

    const selectedTaxRate = useMemo(() => {
        const selectedTaxIds = Array.isArray(wTaxes) ? wTaxes : [];
        return selectedTaxIds.reduce((acc, taxId) => {
            const tax = taxes.find((t) => t.id === taxId);
            return acc + (tax ? tax.rate / 100 : 0);
        }, 0);
    }, [wTaxes, taxes]);

    // Pricing rule (Editar producto / Precio e Impuestos) — mirror AddProductForm:
    // - Base = costo
    // - Precio de venta = base + markup% (default 40%)
    // - Si el precio es "con impuesto", se aplica el/los impuestos encima.
    const calculatePrice = useCallback((cost: number, markupRate: number, taxRate: number, isTaxInclusive: boolean) => {
        if (cost <= 0) return 0;
        const safeMarkupRate = Number.isFinite(markupRate) ? Math.max(0, markupRate) : 0;
        const basePlusMarkup = cost * (1 + safeMarkupRate);
        const newPrice = isTaxInclusive ? basePlusMarkup * (1 + taxRate) : basePlusMarkup;
        return roundMoneyInt(newPrice);
    }, []);

    const calculateCost = useCallback((price: number, markupRate: number, taxRate: number, isTaxInclusive: boolean) => {
        if (price <= 0) return 0;
        const basePlusMarkup = isTaxInclusive ? price / (1 + taxRate) : price;
        const safeMarkupRate = Number.isFinite(markupRate) ? Math.max(0, markupRate) : 0;
        const newCost = basePlusMarkup / (1 + safeMarkupRate);
        return roundMoneyInt(newCost);
    }, []);

    useEffect(() => {
        const markupPercent = Number(wMarkup ?? 0);
        const markupRate = (Number.isFinite(markupPercent) ? Math.max(0, markupPercent) : 0) / 100;
        const includeTax = Boolean(wIsTaxInclusivePrice);

        const currentCost = wCost === null || wCost === undefined ? null : Number(wCost);
        const currentPrice = wPrice === null || wPrice === undefined ? null : Number(wPrice);

        const nextValue = (v: number | null) => (Number.isFinite(Number(v)) ? Number(v) : 0);
        const nearlyEqual = (a: number | null, b: number | null) => Math.abs(nextValue(a) - nextValue(b)) < 0.5;

        if (lastEdited === "price") {
            if (currentPrice === null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
                if (wCost !== undefined) form.setValue("cost", undefined as any, { shouldValidate: true, shouldDirty: false });
                return;
            }
            const newCost = calculateCost(nextValue(currentPrice), markupRate, selectedTaxRate, includeTax);
            if (!nearlyEqual(newCost, currentCost)) {
                form.setValue("cost", newCost as any, { shouldValidate: true, shouldDirty: false });
            }
        } else {
            if (currentCost === null || !Number.isFinite(currentCost) || currentCost <= 0) {
                if (wPrice !== undefined) form.setValue("price", undefined as any, { shouldValidate: true, shouldDirty: false });
                return;
            }
            const newPrice = calculatePrice(nextValue(currentCost), markupRate, selectedTaxRate, includeTax);
            if (!nearlyEqual(newPrice, currentPrice)) {
                form.setValue("price", newPrice as any, { shouldValidate: true, shouldDirty: false });
            }
        }
    }, [wCost, wPrice, wMarkup, wIsTaxInclusivePrice, selectedTaxRate, lastEdited, calculatePrice, calculateCost, form]);

    useEffect(() => {
        if (!productId) {
            loadedProductIdRef.current = null;
            pendingTaxNamesRef.current = null;
            return;
        }

        // Prevent form.reset while the user is typing.
        if (loadedProductIdRef.current === productId) return;
        loadedProductIdRef.current = productId;

        setIsLoading(true);
        setError(null);

        getProductDetails(productId)
            .then((result) => {
                if (result.error) {
                    setError(result.error);
                    return;
                }

                const data: any = (result as any).data;
                if (!data) return;

                let taxIds: number[] = [];

                // Preferred: numeric IDs from ProductTax join.
                if (Array.isArray(data.taxes)) {
                    taxIds = data.taxes
                        .map((t: any) => Number(t?.taxId))
                        .filter((id: any) => Number.isFinite(id));
                } else if (data.taxesText || data.taxes) {
                    // Fallback: legacy CSV of tax names.
                    const names = String(data.taxesText || data.taxes)
                        .split(",")
                        .map((x: string) => x.trim())
                        .filter(Boolean);

                    if (taxes.length > 0) {
                        taxIds = names
                            .map((taxName: string) => {
                                const foundTax = taxes.find((t) => t.name.trim() === taxName.trim());
                                return foundTax ? foundTax.id : null;
                            })
                            .filter((id: number | null) => id !== null) as number[];
                    } else {
                        pendingTaxNamesRef.current = names;
                    }
                }

                form.reset({
                    id: data.id,
                    name: data.name || "",
                    code: data.code || "",
                    description: data.description || "",
                    price: data.price ?? undefined,
                    cost: data.cost ?? undefined,
                    markup: data.markup ?? 40,
                    isTaxInclusivePrice:
                        data.istaxinclusiveprice !== undefined && data.istaxinclusiveprice !== null
                            ? Boolean(data.istaxinclusiveprice)
                            : true,
                    measurementunit: data.measurementunit || "",
                    isenabled: !!data.isenabled,
                    productgroupid: data.productgroupid || undefined,
                    taxes: taxIds,
                    reorderpoint: data.reorderpoint ?? 0,
                    lowstockwarningquantity: data.lowstockwarningquantity ?? 0,
                    islowstockwarningenabled: !!data.islowstockwarningenabled,
                });
            })
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId]);

    useEffect(() => {
        const pending = pendingTaxNamesRef.current;
        if (!pending || pending.length === 0) return;
        if (!taxes || taxes.length === 0) return;
        if (form.formState.isDirty) return;

        const mapped = pending
            .map((taxName) => {
                const foundTax = taxes.find((t) => t.name.trim() === taxName.trim());
                return foundTax ? foundTax.id : null;
            })
            .filter((id): id is number => id !== null);

        pendingTaxNamesRef.current = null;
        form.setValue("taxes", mapped, { shouldValidate: true, shouldDirty: false });
    }, [taxes, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
        setSubmitStatus(null);
    const result = await updateProduct(values as UpdateProductInput);
    setIsSubmitting(false);

    if (result.success) {
            const when = new Intl.DateTimeFormat("es-CO", {
                timeZone: "America/Bogota",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }).format(new Date());
            const who = (currentUserName ?? "").trim() || "Usuario";
            const whatName = String(values.name ?? "").trim() || `Producto #${values.id}`;
            const whatRef = String(values.code ?? "").trim() || String(values.id);
      toast({
        title: "Producto Actualizado",
                description: `${who} · ${when} · ${whatName} (${whatRef})`,
      });
            setSubmitStatus({ type: "success", message: result.message || "Cambios guardados correctamente." });
            setTimeout(() => onClose(), 600);
    } else {
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: result.error || "No se pudieron guardar los cambios.",
      });
            setSubmitStatus({ type: "error", message: result.error || "No se pudieron guardar los cambios." });
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
                        {submitStatus ? (
                            <Alert variant={submitStatus.type === "error" ? "destructive" : "default"}>
                                <AlertTitle>
                                    {submitStatus.type === "success" ? "Guardado exitoso" : "No se pudo guardar"}
                                </AlertTitle>
                                <AlertDescription>{submitStatus.message}</AlertDescription>
                            </Alert>
                        ) : null}

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
                                        <FormField
                                            control={form.control}
                                            name="markup"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Margen / Markup (%)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" inputMode="decimal" min={0} step={0.1} {...field} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Por defecto es 40%. Cambiarlo recalcula costo/precio automáticamente.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                     <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Precio</FormLabel>
                                <FormControl>
                                    <Input
                                                                            inputMode="numeric"
                                                                            pattern="[0-9]*"
                                                                                                                                                        value={field.value === null || field.value === undefined ? "" : formatMoneyInt(field.value)}
                                                                                                                                                        onChange={(e) => {
                                                                                                                                                            setLastEdited("price");
                                                                                                                                                            field.onChange(parseMoneyIntOptional(e.target.value));
                                                                                                                                                        }}
                                    />
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
                                    <Input
                                                                            inputMode="numeric"
                                                                            pattern="[0-9]*"
                                                                                                                                                        value={field.value === null || field.value === undefined ? "" : formatMoneyInt(field.value)}
                                                                                                                                                        onChange={(e) => {
                                                                                                                                                            setLastEdited("cost");
                                                                                                                                                            field.onChange(parseMoneyIntOptional(e.target.value));
                                                                                                                                                        }}
                                    />
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
