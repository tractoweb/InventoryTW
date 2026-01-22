"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export function KardexDocumentDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: number | null;
  documentNumber?: string | null;
  view: "pdf" | "print";
  onViewChange: (view: "pdf" | "print") => void;
  title?: string;
}) {
  const { open, onOpenChange, documentId, documentNumber, view, onViewChange, title } = props;

  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const [loading, setLoading] = React.useState(true);

  const docId = documentId ?? null;

  React.useEffect(() => {
    if (!open) setLoading(true);
  }, [open]);

  React.useEffect(() => {
    // When switching document or view, show loader again.
    if (open) setLoading(true);
  }, [open, docId, view]);

  const src = !docId
    ? null
    : view === "pdf"
      ? `/documents/${docId}/pdf/file`
      : `/documents/${docId}/print/preview`;

  const headerTitle = title ?? (docId ? `Documento ${documentNumber ?? docId}` : "Documento");

  function doPrint() {
    // Always print from HTML print preview for consistent output.
    onViewChange("print");
    setTimeout(() => {
      try {
        frameRef.current?.contentWindow?.focus();
        frameRef.current?.contentWindow?.print();
      } catch {
        // ignore
      }
    }, 700);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl h-[90vh] p-0 overflow-hidden">
        <div className="p-4 pb-0">
          <DialogHeader>
            <DialogTitle>{headerTitle}</DialogTitle>
          </DialogHeader>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tabs value={view} onValueChange={(v) => onViewChange(v as any)}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="pdf">PDF</TabsTrigger>
                <TabsTrigger value="print">Impresión</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button type="button" onClick={doPrint} disabled={!docId}>
              Imprimir
            </Button>
          </div>
        </div>

        {!docId ? (
          <div className="p-4 text-sm text-muted-foreground">Este movimiento no tiene documento origen.</div>
        ) : (
          <div className="mt-4 h-[calc(90vh-120px)] w-full border-t relative">
            {loading ? (
              <div className="absolute inset-0 p-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="mt-3 h-[calc(90vh-170px)] w-full" />
              </div>
            ) : null}
            <iframe
              key={`${docId}-${view}`}
              ref={frameRef}
              title={`Documento ${docId}`}
              src={src ?? undefined}
              className="h-full w-full"
              loading="lazy"
              onLoad={() => setLoading(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
