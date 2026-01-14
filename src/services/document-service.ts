/**
 * Servicio de Documentos - FIXED
 * Gestiona la creación, actualización y finalización de documentos
 * Automáticamente genera números y actualiza Ksdsdsssardex
 */

import { amplifyClient, DOCUMENT_STOCK_DIRECTION, formatAmplifyError } from '@/lib/amplify-config';
import { getBogotaYearMonth } from '@/lib/datetime';
import { createKardexEntry } from './kardex-service';

export interface DocumentCreateRequest {
  documentId: number;
  userId: number;
  customerId?: number;
  orderNumber?: string;
  documentTypeId: number;
  warehouseId: number;
  date: Date;
  dueDate?: Date;
  referenceDocumentNumber?: string;
  note?: string;
  internalNote?: string;
  discount?: number;
  discountType?: number;
  discountApplyRule?: number;
  serviceType?: number;
  items: DocumentItemInput[];
}

export interface DocumentItemInput {
  documentItemId: number;
  productId: number;
  quantity: number;
  price: number;
  discount?: number;
  discountType?: number;
  taxIds?: number[];
  /** Optional unit cost to store on DocumentItem.productCost and use in Kardex. */
  productCost?: number;
}

/**
 * Genera el próximo número de documento
 */
export async function generateDocumentNumber(
  documentTypeId: number,
  warehouseId: number
): Promise<{
  success: boolean;
  number?: string;
  error?: string;
}> {
  try {
    const { year, month } = getBogotaYearMonth(new Date());

    // Buscar o crear registro de número
    const { data: existing } = await amplifyClient.models.DocumentNumber.list({
      filter: {
        documentTypeId: { eq: Number(documentTypeId) },
        warehouseId: { eq: Number(warehouseId) },
        year: { eq: year },
        month: { eq: month },
      },
    });

    let counter = existing?.[0] as any;

    if (!counter) {
      // Crear nuevo contador
      const result = await amplifyClient.models.DocumentNumber.create({
        documentTypeId: Number(documentTypeId),
        warehouseId: Number(warehouseId),
        year,
        month,
        sequence: 1,
        lastNumber: 1,
      });
      counter = result.data as any;
    } else {
      // Incrementar secuencia
      counter = (
        await amplifyClient.models.DocumentNumber.update({
          documentTypeId: Number(documentTypeId),
          warehouseId: Number(warehouseId),
          year,
          month,
          sequence: ((counter as any).sequence || 0) + 1,
          lastNumber: ((counter as any).lastNumber || 0) + 1,
        })
      ).data as any;
    }

    if (!counter) {
      return { success: false, error: 'Failed to generate document number' };
    }

    // Formato: YEAR-TYPE-SEQUENCE (ej: 2025-100-000042)
    const documentType = await amplifyClient.models.DocumentType.get({
      documentTypeId: Number(documentTypeId),
    });

    const type = (documentType.data as any)?.code || '000';
    const sequence = (counter as any)?.sequence || 0;
    const number = `${year}-${type}-${String(sequence).padStart(6, '0')}`;

    return { success: true, number };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Crea un documento con sus items
 */
export async function createDocument(
  input: DocumentCreateRequest
): Promise<{
  success: boolean;
  documentId?: string;
  documentNumber?: string;
  error?: string;
}> {
  try {
    // Generar número de documento
    const { success: genSuccess, number } = await generateDocumentNumber(
      Number(input.documentTypeId),
      Number(input.warehouseId)
    );

    if (!genSuccess || !number) {
      return { success: false, error: 'Failed to generate document number' };
    }

    // Obtener tipo de documento para conocer dirección de stock
    const docType = await amplifyClient.models.DocumentType.get({
      documentTypeId: Number(input.documentTypeId)
    });

    const stockDirection = (docType.data as any)?.stockDirection || DOCUMENT_STOCK_DIRECTION.NONE;

    // Calcular total del documento
    let total = 0;
    for (const item of input.items) {
      const itemTotal = item.quantity * item.price;
      total += itemTotal;
    }

    // Aplicar descuento si existe
    if (input.discount && input.discount > 0) {
      total = input.discountType === 0 ? total - input.discount : total * (1 - input.discount / 100);
    }

    // Validar que documentId esté presente
    if (typeof input.documentId !== 'number' || isNaN(input.documentId)) {
      return { success: false, error: 'documentId es obligatorio y debe ser un número único.' };
    }
    const docResult = await amplifyClient.models.Document.create({
      documentId: input.documentId,
      number: number,
      userId: Number(input.userId),
      customerId: input.customerId !== undefined ? Number(input.customerId) : undefined,
      orderNumber: input.orderNumber,
      date: input.date.toISOString().split('T')[0], // Solo fecha
      stockDate: input.date.toISOString(),
      documentTypeId: Number(input.documentTypeId),
      warehouseId: Number(input.warehouseId),
      total: total,
      dueDate: input.dueDate?.toISOString().split('T')[0],
      referenceDocumentNumber: input.referenceDocumentNumber,
      note: input.note,
      internalNote: input.internalNote,
      discount: input.discount || 0,
      discountType: input.discountType || 0,
      discountApplyRule: input.discountApplyRule || 0,
      serviceType: input.serviceType || 0,
      isClockedOut: false,
      paidStatus: 0,
    });

    if (!(docResult as any).data) {
      const msg = ((docResult as any)?.errors?.[0]?.message as string | undefined) ?? 'Failed to create document';
      return { success: false, error: msg };
    }

    // Crear items del documento
    let itemIndex = 0;
    for (const item of input.items) {
      // Obtener producto para información de costo
      const product = await amplifyClient.models.Product.get({
        idProduct: Number(item.productId)
      });

      const itemPrice = item.price;
      const itemTotal = item.quantity * itemPrice;
      let priceAfterDiscount = itemTotal;

      if (item.discount && item.discount > 0) {
        priceAfterDiscount =
          item.discountType === 0
            ? itemTotal - item.discount
            : itemTotal * (1 - item.discount / 100);
      }

      const itemResult = await amplifyClient.models.DocumentItem.create({
        documentItemId: item.documentItemId,
        documentId: (docResult.data as any).documentId,
        productId: Number(item.productId),
        quantity: item.quantity,
        expectedQuantity: item.quantity,
        price: itemPrice,
        priceBeforeTax: itemPrice,
        discount: item.discount || 0,
        discountType: item.discountType || 0,
        productCost: Number.isFinite(Number(item.productCost)) ? Number(item.productCost) : (product.data as any)?.cost || 0,
        priceBeforeTaxAfterDiscount: priceAfterDiscount,
        priceAfterDiscount: priceAfterDiscount,
        total: itemTotal,
        totalAfterDocumentDiscount: priceAfterDiscount,
        discountApplyRule: 0,
      });

      if (!(itemResult as any)?.data) {
        const msg = ((itemResult as any)?.errors?.[0]?.message as string | undefined) ?? 'Failed to create document item';
        return { success: false, error: `${msg} (productId: ${item.productId})` };
      }

      itemIndex++;

      // Crear registros de impuestos si existen
      if (item.taxIds && item.taxIds.length > 0) {
        for (const taxId of item.taxIds) {
          const tax = await amplifyClient.models.Tax.get({
            idTax: Number(taxId)
          });

          const taxAmount = (priceAfterDiscount * ((tax.data as any)?.rate || 0)) / 100;

          await amplifyClient.models.DocumentItemTax.create({
            documentItemId: (itemResult.data as any)?.documentItemId || '',
            taxId: Number(taxId),
            amount: taxAmount,
          });
        }
      }
    }

    return {
      success: true,
      documentId: String((docResult.data as any)?.documentId ?? input.documentId),
      documentNumber: number,
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}



/**
 * Finaliza un documento y actualiza stocks + kardex
 */
export async function finalizeDocument(
  documentId: number,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Obtener documento
    const doc = await amplifyClient.models.Document.get({
      documentId: Number(documentId)
    });

    if (!doc.data) {
      return { success: false, error: 'Document not found' };
    }

    const docData = doc.data as any;

    // Obtener tipo de documento
    const docType = await amplifyClient.models.DocumentType.get({
      documentTypeId: docData.documentTypeId
    });

    const stockDirection = (docType.data as any)?.stockDirection || DOCUMENT_STOCK_DIRECTION.NONE;

    if (stockDirection === DOCUMENT_STOCK_DIRECTION.NONE) {
      // No afecta stock
      return { success: true };
    }

    // Cargar items del documento (no confiar en `doc.data.items` porque Amplify no los incluye por defecto)
    const allItems: any[] = [];
    let nextToken: string | null | undefined = undefined;
    do {
      const page: any = await amplifyClient.models.DocumentItem.list({
        filter: { documentId: { eq: Number(documentId) } },
        limit: 100,
        nextToken,
      } as any);
      if (page.data) allItems.push(...(page.data as any[]));
      nextToken = (page as any).nextToken;
    } while (nextToken);

    for (const item of allItems) {
      // Obtener stock actual
      const { data: stocks } = await amplifyClient.models.Stock.list({
        filter: {
          productId: { eq: item.productId },
          warehouseId: { eq: docData.warehouseId },
        },
      });

      const stock = (stocks as any[])?.[0];
      const currentQuantity = stock?.quantity || 0;

      // Calcular nueva cantidad
      const quantityChange = stockDirection === DOCUMENT_STOCK_DIRECTION.IN 
        ? item.quantity 
        : -item.quantity;
      const newQuantity = currentQuantity + quantityChange;

      // Actualizar o crear stock
      if (stock) {
        await amplifyClient.models.Stock.update({
          productId: stock.productId,
          warehouseId: stock.warehouseId,
          quantity: newQuantity,
        });
      } else {
        await amplifyClient.models.Stock.create({
          productId: item.productId,
          warehouseId: docData.warehouseId,
          quantity: newQuantity,
        });
      }

      // Crear entrada en Kardex
      await createKardexEntry({
        productId: item.productId,
        date: new Date(docData.stockDate || new Date()),
        documentId: Number(documentId),
        documentNumber: docData.number,
        type: stockDirection === DOCUMENT_STOCK_DIRECTION.IN ? 'ENTRADA' : 'SALIDA',
        quantity: item.quantity,
        balance: newQuantity,
        unitCost: item.productCost,
        totalCost: (item.productCost || 0) * item.quantity,
        userId: Number(userId),
        note: `From document ${docData.number}`,
      });
    }

    // Marcar documento como finalizado
    await amplifyClient.models.Document.update({
      documentId: Number(documentId),
      isClockedOut: true,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

// Exportar el servicio como objeto para compatibilidad
export async function listDocuments() {
  return amplifyClient.models.Document.list();
}

export const documentService = {
  generateDocumentNumber,
  createDocument,
  finalizeDocument,
  listDocuments,
};
