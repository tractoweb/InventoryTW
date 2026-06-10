"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Calendar, User } from "lucide-react";
import { reEnableProduct } from "@/actions/re-enable-product";
import { useToast } from "@/hooks/use-toast";
import type { ProductWithTraceability } from "@/types/product-traceability";

interface DisabledProductDetailsModalProps {
  product: ProductWithTraceability | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReenabled?: () => void;
}

const reasonColorMap: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  Accidental: { bg: "bg-red-100", text: "text-red-800", icon: "⚠️" },
  Duplicate: { bg: "bg-orange-100", text: "text-orange-800", icon: "🔀" },
  Obsolete: { bg: "bg-gray-100", text: "text-gray-800", icon: "🗑️" },
  Temporary: { bg: "bg-yellow-100", text: "text-yellow-800", icon: "⏱️" },
  MERGED_WITH_PRIMARY: { bg: "bg-blue-100", text: "text-blue-800", icon: "🔗" },
};

export function DisabledProductDetailsModal({
  product,
  open,
  onOpenChange,
  onReenabled,
}: DisabledProductDetailsModalProps) {
  const { toast } = useToast();
  const [isReenabling, setIsReenabling] = React.useState(false);

  const handleReenable = async () => {
    if (!product) return;

    setIsReenabling(true);
    try {
      const result = await reEnableProduct(
        product.id,
        `Manual re-enable: Was marked as ${product.disabledReason}`
      );

      if (result.success) {
        toast({
          title: "✅ Producto rehabilitado",
          description: result.message,
        });
        onOpenChange(false);
        onReenabled?.();
      } else {
        toast({
          variant: "destructive",
          title: "❌ Error",
          description: result.error,
        });
      }
    } finally {
      setIsReenabling(false);
    }
  };

  if (!product || !open) return null;

  const reasonStyle =
    reasonColorMap[product.disabledReason as keyof typeof reasonColorMap] ||
    reasonColorMap["UNKNOWN" as any];
  const isAccidental = product.disabledReason === "Accidental";
  const isMerged = product.disabledReason === "MERGED_WITH_PRIMARY";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{reasonStyle.icon}</span>
            Detalles de Deshabilitación: {product.name}
          </DialogTitle>
          <DialogDescription>
            Información completa sobre por qué este producto fue deshabilitado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ALERTA SI ES ACCIDENTAL */}
          {isAccidental && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>⚠️ Deshabilitado Accidentalmente</AlertTitle>
              <AlertDescription>
                Este producto fue marcado como deshabilitado de forma accidental. 
                ¿Deseas rehabilitarlo ahora?
              </AlertDescription>
            </Alert>
          )}

          {/* ALERTA SI ES MERGED */}
          {isMerged && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>🔗 Producto Fusionado</AlertTitle>
              <AlertDescription>
                Este producto fue fusionado con otro. 
                {product.mergedIntoProductId && (
                  <> Merged con: ID {product.mergedIntoProductId}</>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* INFO PRINCIPAL */}
          <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">ID</p>
              <p className="font-mono font-bold">{product.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Código</p>
              <p className="font-mono">{product.code || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <Badge variant="destructive" className="mt-1">
                Deshabilitado
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Razón</p>
              <Badge className={`mt-1 ${reasonStyle.bg} ${reasonStyle.text}`}>
                {product.disabledReason}
              </Badge>
            </div>
          </div>

          {/* TIMESTAMPS */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">📅 Timestamps</h4>
            {product.disabledAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Deshabilitado: {new Date(product.disabledAt).toLocaleString()}</span>
              </div>
            )}
            {product.lastEnabledAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                <span>Última activación: {new Date(product.lastEnabledAt).toLocaleString()}</span>
              </div>
            )}
            {product.createdAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Creado: {new Date(product.createdAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* IMPACTO */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">📊 Impacto en BD</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="text-xs text-blue-600 font-medium">Documentos</p>
                <p className="text-xl font-bold text-blue-900">{product.documentCount}</p>
              </div>
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <p className="text-xs text-green-600 font-medium">Stock Total</p>
                <p className="text-xl font-bold text-green-900">{product.stock}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded border border-purple-200">
                <p className="text-xs text-purple-600 font-medium">Kardex</p>
                <p className="text-xl font-bold text-purple-900">{product.kardexCount}</p>
              </div>
            </div>
          </div>

          {/* NOTA DE AUDITORÍA */}
          <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs text-gray-600">
            <p className="font-semibold mb-1">🔒 Auditoría</p>
            <p>
              Este producto está marcado como soft-delete. Todos los registros históricos 
              (Documentos, Stock, Kardex) se preservan para trazabilidad.
            </p>
          </div>

          {/* ACCIONES */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {!isMerged && (
              <Button onClick={handleReenable} disabled={isReenabling}>
                {isReenabling ? "Rehabilitando..." : "✅ Rehabilitar Producto"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
