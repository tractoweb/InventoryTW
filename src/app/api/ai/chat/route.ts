import { streamText, tool } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';
import { stepCountIs } from 'ai';
import { type NextRequest } from 'next/server';

import { getCurrentSession } from '@/lib/session';
import { searchProductsAction } from '@/actions/search-products';
import { getStockForProductsAction } from '@/actions/get-stock-for-products';
import { getProductDetails } from '@/actions/get-product-details';
import { getKardexEntriesAction } from '@/actions/get-kardex-entries';
import { getDashboardStats } from '@/actions/get-dashboard-stats';
import { searchCustomersAction } from '@/actions/search-customers';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ----- Model selection -------------------------------------------------------

const HAIKU = 'anthropic.claude-3-5-haiku-20241022-v1:0';
const SONNET = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

const COMPLEX_KW = ['analiza', 'compara', 'diagnóstico', 'estrategia', 'tendencia',
  'explica por qué', 'recomienda', 'informe', 'proyección', 'diferencia entre'];

function pickModel(text: string): string {
  const lower = text.toLowerCase();
  const isComplex = text.length > 300 || COMPLEX_KW.some((k) => lower.includes(k));
  return isComplex ? SONNET : HAIKU;
}

// ----- System prompt ---------------------------------------------------------

function buildSystemPrompt(userName: string): string {
  return `Eres el Asistente de Inventario de TRACTO AGRÍCOLA, experto en repuestos para maquinaria agrícola (tractores John Deere, Fiat 780, Massey Ferguson, Case IH y otros).
Asistes a ${userName} en consultas en tiempo real sobre el inventario.

## Capacidades
- Consultar stock, precios y ubicaciones de repuestos por nombre, código o descripción.
- Verificar stock disponible por bodega y comparar entre bodegas.
- Resumir valores de inventario (total de unidades, valor en costo, productos agotados, bajo stock).
- Ayudar a identificar repuestos por síntoma o número de modelo de máquina.
- Consultar historial de movimientos (kardex) de una pieza.
- Buscar clientes y proveedores registrados.
- Consultar información técnica en la web cuando el catálogo interno no sea suficiente.

## Formato de respuesta
- Responde siempre en **español**.
- Usa Markdown: negritas para destacar datos clave, listas para múltiples resultados.
- **SIEMPRE incluye links clickeables** que lleven directo al módulo relevante:
  - Buscar un producto por nombre: [🔍 Ver en Inventario](/inventory?search=NOMBRE)
  - Ir al kardex de una pieza (cuando tengas su ID): [📋 Ver Kardex](/kardex?productId=ID)
  - Ver un documento específico: [📄 Ver Documento](/documents/ID)
  - Ver el módulo de stock: [📦 Ver Stock](/stock)
  - Ver proveedores o clientes: [🏢 Ver Proveedores](/suppliers) · [👥 Ver Clientes](/clients)
- Precios: formato **$X,XXX.XX**
- Stock: usa íconos ✅ (suficiente), ⚠️ (bajo), ❌ (agotado) para estado visual.

## Restricciones
- Si no encuentras un dato en el sistema, dilo claramente y sugiere una búsqueda alternativa.
- No inventes precios ni stock; consulta siempre las herramientas.
- Para compatibilidad técnica compleja de piezas en máquinas específicas, usa buscarEnWeb para complementar.
- No respondas preguntas fuera del ámbito de inventario, repuestos o clientes/proveedores del sistema.`;
}

// ----- Message validation ----------------------------------------------------

function sanitizeMessages(raw: unknown): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-40) // Keep last 40 messages (conversation history)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 4000) }));
}

// ----- Route handler ---------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Auth: validate existing app session
  const session = await getCurrentSession();
  if (!session.data) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Parse body
  let body: { messages?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
    return new Response(JSON.stringify({ error: 'Mensaje inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lastText = messages.at(-1)?.content ?? '';
  const userName = [session.data.firstName, session.data.lastName].filter(Boolean).join(' ') || 'Usuario';

  // 3. Bedrock client
  const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });

  // 4. Stream
  try {
    const result = streamText({
      model: bedrock(pickModel(lastText)),
      system: buildSystemPrompt(userName),
      messages: messages as any,
      tools: {
        // ── Tool 1: Search products ────────────────────────────────────────
        buscarProductos: tool({
          description:
            'Busca productos en el inventario por nombre, código de repuesto o descripción. ' +
            'Úsalo cuando el usuario mencione un tipo de pieza o repuesto.',
          inputSchema: z.object({
            query: z.string().describe('Nombre, código o descripción del repuesto a buscar'),
            limite: z.number().int().min(1).max(20).optional().default(10),
          }),
          execute: async ({ query, limite }): Promise<any> => {
            const res = await searchProductsAction(String(query), Number(limite ?? 10));
            if (res.error) return { error: res.error };
            return { productos: res.data.slice(0, limite ?? 10) };
          },
        }),

        // ── Tool 2: Check stock ─────────────────────────────────────────────
        verificarStock: tool({
          description:
            'Verifica la cantidad disponible de productos específicos en una bodega. ' +
            'Usa PRIMERO buscarProductos para obtener los IDs de producto.',
          inputSchema: z.object({
            productIds: z
              .array(z.number().int().positive())
              .min(1)
              .max(20)
              .describe('IDs de productos a consultar (los de buscarProductos)'),
            warehouseId: z
              .number()
              .int()
              .positive()
              .describe('ID de bodega. Usa 1 si no sabes el ID específico'),
          }),
          execute: async ({ productIds, warehouseId }): Promise<any> => {
            const res = await getStockForProductsAction({ productIds, warehouseId });
            if (res.error) return { error: res.error };
            return { stock: res.data };
          },
        }),

        // ── Tool 3: Product detail ──────────────────────────────────────────
        detalleProducto: tool({
          description:
            'Obtiene el detalle completo de un producto: precio de venta, costo, grupo, unidad de medida y stock por bodega.',
          inputSchema: z.object({
            productId: z.number().int().positive().describe('ID del producto'),
          }),
          execute: async ({ productId }): Promise<any> => {
            const res = await getProductDetails(productId);
            if (res.error) return { error: res.error };
            const raw = res.data as any;
            // inventoryService.getProductDetails returns { product, stocks, documentItems }
            const p = raw?.product ?? raw;
            return {
              id: p?.idProduct,
              nombre: p?.name,
              codigo: p?.code,
              precio: p?.price,
              costo: p?.cost,
              markup: p?.markup,
              grupo: p?.productGroup?.name ?? null,
              unidadMedida: p?.measurementUnit,
              habilitado: p?.isEnabled,
              stocks: (raw?.stocks ?? []).map((s: any) => ({
                warehouseId: s.warehouseId,
                cantidad: s.quantity,
              })),
            };
          },
        }),

        // ── Tool 4: Kardex (movement history) ──────────────────────────────
        consultarKardex: tool({
          description:
            'Consulta el historial de movimientos de inventario de un producto: entradas por compra, salidas por venta, ajustes manuales.',
          inputSchema: z.object({
            productId: z.number().int().positive().describe('ID del producto'),
            tipo: z
              .enum(['ENTRADA', 'SALIDA', 'AJUSTE'])
              .optional()
              .describe('Filtrar por tipo (opcional)'),
            limite: z.number().int().min(1).max(30).optional().default(10),
          }),
          execute: async ({ productId, tipo, limite }): Promise<any> => {
            const res = await getKardexEntriesAction({
              productId,
              type: tipo as any,
              limit: limite ?? 10,
            });
            if (res.error) return { error: res.error };
            return {
              movimientos: (res.data ?? []).slice(0, limite ?? 10).map((k) => ({
                fecha: k.date,
                tipo: k.type,
                cantidad: k.quantity,
                balance: k.balance,
                costoUnitario: k.unitCost,
                documento: k.documentNumber,
                nota: k.note,
              })),
            };
          },
        }),

        // ── Tool 5: Inventory summary ───────────────────────────────────────
        resumenInventario: tool({
          description:
            'Obtiene estadísticas globales del inventario: total de unidades, valor total en costo, productos con bajo stock o agotados.',
          inputSchema: z.object({}),
          execute: async (): Promise<any> => {
            const res = await getDashboardStats();
            if (res.error) return { error: res.error };
            return res.data;
          },
        }),

        // ── Tool 6: Search customers / suppliers ────────────────────────────
        buscarCliente: tool({
          description: 'Busca clientes o proveedores por nombre, RUC/NIT o código.',
          inputSchema: z.object({
            query: z.string().describe('Nombre, RUC o código del cliente o proveedor'),
            tipo: z
              .enum(['cliente', 'proveedor', 'ambos'])
              .optional()
              .default('ambos')
              .describe('Tipo de entidad a buscar'),
          }),
          execute: async ({ query, tipo }): Promise<any> => {
            const res = await searchCustomersAction(String(query), 10, {
              onlySuppliers: tipo === 'proveedor',
              onlyCustomers: tipo === 'cliente',
            });
            if (res.error) return { error: res.error };
            return { resultados: res.data.slice(0, 10) };
          },
        }),

        // ── Tool 7: Web search ──────────────────────────────────────────────
        buscarEnWeb: tool({
          description:
            'Busca información técnica en la web: precios de mercado de repuestos, compatibilidad de piezas, ' +
            'especificaciones de modelos. Úsalo SOLO cuando el inventario interno no tenga la información.',
          inputSchema: z.object({
            consulta: z
              .string()
              .max(200)
              .describe('Términos de búsqueda (describe la pieza o problema específico)'),
          }),
          execute: async ({ consulta }): Promise<any> => {
            // Sanitize input to prevent injection via query params
            const safe = String(consulta)
              .replace(/[<>"'`]/g, '')
              .trim()
              .slice(0, 200);
            const q = encodeURIComponent(safe + ' repuesto tractor precio agrícola');
            const url = `https://html.duckduckgo.com/html/?q=${q}`;

            try {
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 8000);

              const res = await fetch(url, {
                signal: ctrl.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; InventoryAssistant/1.0)',
                  Accept: 'text/html',
                },
              });
              clearTimeout(timer);

              if (!res.ok) return { error: 'No se pudo acceder a la web' };

              const html = await res.text();

              // Extract text snippets from DuckDuckGo results (max 5)
              const snippets = [...html.matchAll(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
                .slice(0, 5)
                .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
                .filter(Boolean);

              return {
                resultados: snippets.length
                  ? snippets
                  : ['No se encontraron resultados relevantes en la web.'],
              };
            } catch (err: any) {
              if (err?.name === 'AbortError') return { error: 'La búsqueda web tomó demasiado tiempo.' };
              return { error: 'Error al consultar la web. Intenta reformular la búsqueda.' };
            }
          },
        }),
      },

      stopWhen: stepCountIs(8),
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    console.error('[AI Chat] Error en streamText:', err?.message ?? err);
    const isCredErr =
      String(err?.message ?? '').toLowerCase().includes('credential') ||
      String(err?.message ?? '').toLowerCase().includes('access') ||
      String(err?.message ?? '').toLowerCase().includes('auth');

    const msg = isCredErr
      ? 'No se pudo conectar con AWS Bedrock. Verifica las credenciales en .env.local (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION).'
      : `Error al procesar la solicitud: ${err?.message ?? 'Error desconocido'}`;

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

