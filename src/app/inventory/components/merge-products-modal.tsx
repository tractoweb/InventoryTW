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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  TrendingDown,
} from "lucide-react";
import { mergeProducts } from "@/actions/merge-products";
import { useToast } from "@/hooks/use-toast";
import type { DuplicateCandidate } from "@/actions/get-duplicate-candidates";

interface MergeProductsModalProps {
  candidate: DuplicateCandidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged?: () => void;
}

export function MergeProductsModal({
  candidate,
  open,
  onOpenChange,
  onMerged,
}: MergeProductsModalProps) {
  const { toast } = useToast();
  const [isMerging, setIsMerging] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  const handleMerge = async () => {
    if (!candidate || !confirmed) return;

    setIsMerging(true);
    try {
      const result = await mergeProducts(
        candidate.primaryProductId,
        candidate.duplicateProductId,
        notes
      );

      if (result.success) {
        toast({
          title: "✅ Fusión completada",
          description: `${result.barcodesMerged} barcodes, ${result.commentsMerged} comentarios transferidos`,
        });
        setConfirmed(false);
        setNotes("");
        onOpenChange(false);
        onMerged?.();
      } else {
        toast({
          variant: "destructive",
          title: "❌ Error en fusión",
          description: result.error,
        });
      }
    } finally {
      setIsMerging(false);
    }
  };

  if (!candidate || !open) return null;

  // Determinar tipo de alerta según match type y confidence
  const getAlertType = () => {
    if (candidate.confidence >= 0.95) return "critical";
    if (candidate.confidence >= 0.8) return "warning";
    return "info";
  };

  const alertType = getAlertType();
  const alertConfig: Record<string, { icon: React.ReactNode; title: string; color: string }> = {
    critical: {
      icon: <AlertTriangle className="h-4 w-4" />,
      title: "Alta probabilidad de duplicado",
      color: "bg-red-50 border-red-200",
    },
    warning: {
      icon: <AlertTriangle className="h-4 w-4" />,
      title: "Probable duplicado",
      color: "bg-yellow-50 border-yellow-200",
    },
    info: {
      icon: <CheckCircle className="h-4 w-4" />,
      title: "Candidato a duplicado",
      color: "bg-blue-50 border-blue-200",
    },
  };

  const alert = alertConfig[alertType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Fusionar Productos Duplicados
          </DialogTitle>
          <DialogDescription>
            Revisar antes de confirmar. Esto marcará el duplicado como deshabilitado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ALERTA INTELIGENTE */}
          <Alert className={alert.color}>
            {alert.icon}
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>
              Confianza: {(candidate.confidence * 100).toFixed(0)}% | Razón: {candidate.reason}
            </AlertDescription>
          </Alert>

          {/* COMPARATIVA */}
          <div className="grid grid-cols-2 gap-4">
            {/* PRIMARIO */}
            <div className="border-2 border-green-200 bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-green-600">PRIMARIO (se mantiene)</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-600">Producto</p>
                  <p className="font-semibold">{candidate.primaryProductName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">ID / Código</p>
                  <p className="font-mono text-xs">
                    {candidate.primaryProductId} / {candidate.primaryProductCode || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-green-200">
                  <div className="bg-white p-2 rounded">
                    <p className="text-xs text-gray-600">Stock</p>
                    <p className="font-bold text-green-700">{candidate.primaryStock}</p>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <p className="text-xs text-gray-600">Documentos</p>
                    <p className="font-bold">{candidate.primaryDocumentCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* DUPLICADO */}
            <div className="border-2 border-red-200 bg-red-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="destructive">DUPLICADO (será deshabilitado)</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-600">Producto</p>
                  <p className="font-semibold">{candidate.duplicateProductName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">ID / Código</p>
                  <p className="font-mono text-xs">
                    {candidate.duplicateProductId} / {candidate.duplicateProductCode || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-red-200">
                  <div className="bg-white p-2 rounded">
                    <p className="text-xs text-gray-600">Stock</p>
                    <p className="font-bold text-red-700">{candidate.duplicateStock}</p>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <p className="text-xs text-gray-600">Documentos</p>
                    <p className="font-bold">{candidate.duplicateDocumentCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* QUÉ SUCEDE */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="font-semibold text-sm mb-2">📋 Qué sucederá en la fusión:</p>
            <ul className="text-sm space-y-1 text-gray-700">
              <li>✅ Barcodes del duplicado → transferidos al primario</li>
              <li>✅ Comentarios → copiados y marcados como [MERGED FROM DUP]</li>
              <li>✅ StockControls → fusionados (mejor valor)</li>
              <li>🔒 Documentos → PRESERVADOS (no se modifican)</li>
              <li>🔒 Kardex → PRESERVADO (auditoría intacta)</li>
              <li>⛔ Duplicado → DESHABILITADO con motivo MERGED_WITH_PRIMARY</li>
            </ul>
          </div>

          {/* NOTAS OPCIONALES */}
          <div>
            <label className="text-sm font-medium mb-2 block">Notas (opcional)</label>
            <Textarea
              placeholder="Ej: Este era un error de importación de datos..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-20"
            />
          </div>

          {/* CONFIRMACIÓN */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={confirmed} onCheckedChange={setConfirmed} />
              <span className="text-sm">
                Confirmo que entiendo que esto es una fusión{" "}
                <strong>IRREVERSIBLE</strong>. El producto duplicado será marcado
                como deshabilitado pero sus históricos se preservan. 
                <strong> No se pueden eliminar documentos de este producto.</strong>
              </span>
            </label>
          </div>

          {/* ACCIONES */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmed(false);
                setNotes("");
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!confirmed || isMerging}
              className="bg-red-600 hover:bg-red-700"
            >
              {isMerging ? "Fusionando..." : "🔗 Confirmar Fusión"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
