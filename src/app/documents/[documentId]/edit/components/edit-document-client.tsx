'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

import { updateDocumentMetadataAction } from '@/actions/update-document-metadata';
import { updateDocumentItemsAction } from '@/actions/update-document-items';

import type { DocumentDetails } from '@/actions/get-document-details';

interface EditDocumentClientProps {
  document: DocumentDetails;
}

type DraftItem = {
  key: string;
  documentItemId?: number;
  productId?: number;
  productNameSnapshot?: string;
  quantity: number;
  price: number;
  updateProductPrice?: boolean;
  remove?: boolean;
};

export function EditDocumentClient({ document }: EditDocumentClientProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [saving, setSaving] = React.useState(false);
  const [note, setNote] = React.useState(document.note ?? '');
  const [clientName, setClientName] = React.useState(document.customername ?? '');
  const [items, setItems] = React.useState<DraftItem[]>(
    (document.items ?? []).map((item, idx) => ({
      key: `item-${item.id}`,
      documentItemId: item.id,
      productId: item.productid,
      productNameSnapshot: item.productname,
      quantity: item.quantity ?? 0,
      price: item.price ?? 0,
      updateProductPrice: false,
      remove: false,
    }))
  );

  const [anyChanges, setAnyChanges] = React.useState(false);

  const trackChanges = React.useCallback(() => {
    const noteChanged = note !== (document.note ?? '');
    const clientChanged = clientName !== (document.customername ?? '');
    const itemsChanged = items.some((i) => i.remove || i.updateProductPrice);
    const quantityChanged = items.some((i, idx) => {
      const orig = document.items?.[idx];
      return orig && (i.quantity !== orig.quantity || i.price !== orig.price);
    });

    setAnyChanges(noteChanged || clientChanged || itemsChanged || quantityChanged);
  }, [note, clientName, items, document]);

  React.useEffect(() => {
    trackChanges();
  }, [trackChanges]);

  const handleSave = async () => {
    if (!anyChanges) {
      toast({ title: 'Sin cambios', description: 'No hay cambios para guardar.' });
      return;
    }

    setSaving(true);
    try {
      // Update metadata (note, clientName)
      const metadataRes = await updateDocumentMetadataAction({
        documentId: document.id,
        customerId: undefined,
        note: note || undefined,
        clientName: clientName || undefined,
      });

      if (!metadataRes.success) {
        toast({
          variant: 'destructive',
          title: 'Error al guardar metadatos',
          description: metadataRes.error ?? 'No se pudieron guardar los cambios.',
        });
        return;
      }

      // Update items (quantities, prices, removals)
      const itemsPayload: Array<{
        documentItemId: number | undefined;
        quantity?: number;
        price?: number;
        updateProductPrice?: boolean;
        remove?: boolean;
      }> = [
        ...items
          .filter((i) => !i.remove && i.quantity > 0)
          .map((i) => ({
            documentItemId: i.documentItemId,
            quantity: Math.max(0, i.quantity),
            price: Math.max(0, i.price),
            updateProductPrice: i.updateProductPrice || false,
          })),
        ...items
          .filter((i) => i.remove && i.documentItemId)
          .map((i) => ({
            documentItemId: i.documentItemId,
            remove: true,
          })),
      ];

      if (itemsPayload.length > 0) {
        const itemsRes = await updateDocumentItemsAction({
          documentId: document.id,
          items: itemsPayload as any,
        });

        if (!itemsRes.success) {
          toast({
            variant: 'destructive',
            title: 'Error al actualizar items',
            description: itemsRes.error ?? 'No se pudieron guardar los cambios.',
          });
          return;
        }
      }

      toast({
        title: 'Documento actualizado',
        description: 'Los cambios se han guardado exitosamente.',
      });

      // Redirect back to documents
      setTimeout(() => router.push('/documents'), 500);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message ?? 'No se pudo guardar.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/documents" className="hover:opacity-70">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Editar Documento #{document.number}</h1>
          <p className="text-sm text-gray-500">
            {document.documenttypename} • {document.date}
          </p>
        </div>
      </div>

      {/* Alert about trazabilidad */}
      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Todos los cambios se registran en el historial de auditoría (trazabilidad). 
          Se mantiene un registro de quién cambió qué y cuándo.
        </AlertDescription>
      </Alert>

      {document.isclockedout ? (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            Este documento está finalizado. Al guardar, el sistema actualizará stock con movimientos compensatorios y registrará una anotación de ajuste en Kardex.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Metadata */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Información del Documento</CardTitle>
          <CardDescription>Actualiza los detalles del documento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Boolean(document.documenttypecategoryid === 2) && (
            <div>
              <Label htmlFor="clientName">Nombre del Cliente</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
          )}

          <div>
            <Label htmlFor="note">Nota Interna</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notas internas sobre este documento..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Items del Documento</CardTitle>
          <CardDescription>Edita cantidades, precios o elimina items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-gray-500">No hay items en este documento.</p>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.key}
                  className={`p-3 border rounded-lg ${item.remove ? 'opacity-50 line-through' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.productNameSnapshot || `Producto #${item.productId}`}</p>
                      <p className="text-xs text-gray-500">ID: {item.documentItemId}</p>
                    </div>
                    <button
                      onClick={() => {
                        const newItems = [...items];
                        newItems[idx].remove = !newItems[idx].remove;
                        setItems(newItems);
                      }}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      {item.remove ? 'Restaurar' : 'Eliminar'}
                    </button>
                  </div>

                  {!item.remove && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <Label className="text-xs">Cantidad</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].quantity = Number(e.target.value) || 0;
                            setItems(newItems);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Precio Unitario</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].price = Number(e.target.value) || 0;
                            setItems(newItems);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/documents">Cancelar</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving || !anyChanges} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
}
