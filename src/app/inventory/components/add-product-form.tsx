
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  name: z.string().min(2, "El nombre del producto es obligatorio."),
  code: z.string().optional(),
  measurementUnit: z.string().min(1, "La posición es obligatoria."),
  productGroupId: z.coerce.number().min(1, "Debe seleccionar una categoría."),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  isUsingDefaultQuantity: z.boolean().default(true),
  price: z.preprocess(parseMoneyIntOptional, z.number().int().min(1, "El precio debe ser mayor a 0.")),
  cost: z.preprocess(parseMoneyIntOptional, z.number().int().min(1, "El costo debe ser mayor a 0.")),
  markup: z.coerce.number().min(0, "El margen no puede ser negativo.").default(40),
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
  currentUserName?: string;
};

export function AddProductForm({ setOpen, productGroups, warehouses, taxes, currentUserName }: AddProductFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
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
      price: undefined,
      cost: undefined,
      markup: 40,
      isTaxInclusivePrice: true,
      taxes: [],
      reorderPoint: 0,
      lowStockWarningQuantity: 0,
      isLowStockWarningEnabled: true,
      initialQuantity: 0,
    },
  });

  // Track what the user last edited to avoid cost<->price feedback loops.
  const [lastEdited, setLastEdited] = useState<"cost" | "price">("cost");

  const wCost = useWatch({ control: form.control, name: "cost" });
  const wPrice = useWatch({ control: form.control, name: "price" });
  const wMarkup = useWatch({ control: form.control, name: "markup" });
  const wTaxes = useWatch({ control: form.control, name: "taxes" });
  const wIsTaxInclusivePrice = useWatch({ control: form.control, name: "isTaxInclusivePrice" });

  const codeValue = form.watch("code");
  const debouncedCode = useDebounce(codeValue, 500);

  useEffect(() => {
    if (debouncedCode && debouncedCode.length > 0) {
      setIsCheckingCode(true);
      checkReferenceExistence(debouncedCode)
        .then((result) => {
          setIsCheckingCode(false);
          if (result.exists) {
            form.setError("code", {
              type: "manual",
              message: "Esta referencia ya está en uso.",
            });
          } else {
            form.clearErrors("code");
          }
        })
        .catch(() => {
          // If the server check fails (session/network), don't block product creation.
          setIsCheckingCode(false);
          form.clearErrors("code");
        });
    } else {
        form.clearErrors("code");
    }
  }, [debouncedCode, form]);


  const selectedTaxRate = useMemo(() => {
    const selectedTaxIds = Array.isArray(wTaxes) ? wTaxes : [];
    return selectedTaxIds.reduce((acc, taxId) => {
      const tax = taxes.find((t) => t.id === taxId);
      return acc + (tax ? tax.rate / 100 : 0);
    }, 0);
  }, [wTaxes, taxes]);
  
  // Pricing rule (Nuevo producto / Precio e Impuestos):
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


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setSubmitStatus(null);
    const result = await addProduct(values);
    setIsSubmitting(false);

    if (result.success) {
      const when = new Date().toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const who = (currentUserName ?? "").trim() || "Usuario";
      const whatName = String(values.name ?? "").trim() || "(sin nombre)";
      const whatRef = String(values.code ?? "").trim() || "(sin referencia)";
      toast({
        title: "Producto Creado",
        description: `${who} · ${when} · ${whatName} (${whatRef})`,
      });
      setSubmitStatus({ type: "success", message: result.message || "Producto creado correctamente." });
      // Give the user a moment to see the confirmation inside the dialog.
      setTimeout(() => setOpen(false), 600);
    } else {
      toast({
        variant: "destructive",
        title: "Error al crear el producto",
        description: result.error || "No se pudo añadir el producto.",
      });
      setSubmitStatus({ type: "error", message: result.error || "No se pudo añadir el producto." });
    }
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
                        <FormLabel>Precio de Venta</FormLabel>
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
