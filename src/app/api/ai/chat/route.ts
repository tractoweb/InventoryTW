/**
 * POST /api/ai/chat
 *
 * Proxy server-side hacia AWS Bedrock (Claude).
 *
 * Credenciales: IAM estáticas via variables de entorno (BEDROCK_ACCESS_KEY_ID /
 * BEDROCK_SECRET_ACCESS_KEY). Este route corre en el servidor de Next.js, no en
 * el browser, por lo que NO usa Cognito session credentials.
 * Configura las variables en Amplify Console → App → Environment variables.
 *
 * Formatos de request aceptados:
 *   { messages: [{role, content}, ...] }         ← panel flotante (streaming)
 *   { message: string, context?: {...} }          ← página /ai-lab (JSON)
 *
 * Formato de respuesta:
 *   - Si el request incluye "messages" → stream text/plain (compatible con el panel)
 *   - Si el request incluye "message"  → JSON { response, model, timestamp }
 */
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { type NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { amplifyClient } from '@/lib/amplify-config';

export const runtime = 'nodejs';
export const maxDuration = 30;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type IncomingAttachment = {
  name?: string;
  mimeType?: string;
  kind?: 'image' | 'text' | 'document';
  dataUrl?: string;
  text?: string;
};

type ProductMatch = {
  id: number;
  code: string;
  name: string;
  stock: number | null;
};

type DocumentMatch = {
  id: number;
  number: string;
  date: string;
  total: number;
};

type WarehouseMatch = {
  id: number;
  name: string;
};

type KardexMatch = {
  id: number;
  type: string;
  date: string;
  quantity: number;
  productId: number | null;
  warehouseId: number | null;
};

type WebResult = {
  title: string;
  url: string;
  snippet: string;
};

type AssistantLink = {
  label: string;
  url: string;
};

type AssistantTable = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
};

type ActionProposal = {
  id: string;
  kind?: 'navigate' | 'write' | 'analysis';
  title: string;
  description: string;
  requiresConfirmation: boolean;
  requiresDoubleConfirmation?: boolean;
  link?: AssistantLink;
  execute?: {
    operation: 'adjustStock' | 'createProduct';
    params: Record<string, unknown>;
  };
};

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  const direct = raw === undefined || raw === null ? '' : String(raw).trim();
  if (direct) return direct;

  // AWS Amplify Hosting may expose runtime secrets via process.env.secrets.
  const secrets = (process.env as any)?.secrets as Record<string, unknown> | undefined;
  const secretVal = secrets?.[name];
  const secret = secretVal ? String(secretVal).trim() : '';
  if (secret) return secret;

  // Fallback for hosting setups where runtime env is not injected into SSR.
  // Snapshot is created during build by scripts/write-runtime-email-config.cjs.
  try {
    const cfgPath = path.join(process.cwd(), '.next', 'server', 'runtime-email-config.json');
    if (fs.existsSync(cfgPath)) {
      const rawCfg = fs.readFileSync(cfgPath, 'utf8');
      const parsed = JSON.parse(rawCfg) as Record<string, unknown>;
      const snapVal = parsed?.[name];
      const snap = snapVal ? String(snapVal).trim() : '';
      if (snap) return snap;
    }
  } catch {
    // ignore
  }

  return undefined;
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => m && typeof m.role === 'string' && typeof m.content === 'string')
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .slice(-16)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 3000) }));
}

function sanitizeAttachments(raw: unknown): IncomingAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a: any) => a && typeof a === 'object')
    .slice(0, 6)
    .map((a: any) => ({
      name: typeof a.name === 'string' ? a.name.slice(0, 120) : undefined,
      mimeType: typeof a.mimeType === 'string' ? a.mimeType.slice(0, 80) : undefined,
      kind: a.kind === 'image' || a.kind === 'text' || a.kind === 'document' ? a.kind : undefined,
      dataUrl: typeof a.dataUrl === 'string' ? a.dataUrl.slice(0, 2_500_000) : undefined,
      text: typeof a.text === 'string' ? a.text.slice(0, 12_000) : undefined,
    }));
}

function toLower(v: unknown): string {
  return String(v ?? '').toLowerCase().trim();
}

function normalizeSearch(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearch(v: unknown): string[] {
  return normalizeSearch(v)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function asNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = String(m[1] ?? '').toLowerCase();
  const b64 = String(m[2] ?? '');
  try {
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return null;
    return { mime, bytes: new Uint8Array(buf) };
  } catch {
    return null;
  }
}

function imageFormatFromMime(mime: string): 'png' | 'jpeg' | 'gif' | 'webp' | null {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  return null;
}

async function fetchProductMatches(query: string): Promise<ProductMatch[]> {
  const normalized = normalizeSearch(query);
  const tokens = tokenizeSearch(query);
  try {
    const rows: any[] = [];
    let nextToken: string | null | undefined = undefined;
    const pageLimit = 250;
    const maxPages = 20;
    let page = 0;

    do {
      const res: any = await amplifyClient.models.Product.list({ limit: pageLimit, nextToken } as any);
      rows.push(...((res?.data ?? []) as any[]));
      nextToken = res?.nextToken;
      page++;
      if (page >= maxPages) break;
    } while (nextToken);

    const projected = rows
      .map((p) => {
        const id = asNumber((p as any).idProduct ?? (p as any).productId);
        const code = String((p as any).code ?? (p as any).productCode ?? '').trim();
        const name = String((p as any).name ?? (p as any).productName ?? '').trim();
        const description = String((p as any).description ?? '').trim();
        const stock = asNumber((p as any).stock);
        return { id, code, name, description, stock };
      });

    const filtered = normalized.length >= 2
      ? projected
          .map((p) => {
            const haystack = normalizeSearch(`${p.code} ${p.name} ${p.description}`);
            const full = normalized && haystack.includes(normalized) ? 3 : 0;
            const tokenScore = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
            return { ...p, score: full + tokenScore };
          })
          .filter((p) => p.id && p.score > 0)
          .sort((a, b) => b.score - a.score)
      : projected.filter((p) => p.id);

    const matches = filtered
      .slice(0, 8)
      .map((p) => ({ id: Number(p.id), code: p.code, name: p.name, stock: p.stock }));

    return matches;
  } catch {
    return [];
  }
}

async function fetchDocumentMatches(query: string): Promise<DocumentMatch[]> {
  const normalized = normalizeSearch(query);
  const tokens = tokenizeSearch(query);
  try {
    const rows: any[] = [];
    let nextToken: string | null | undefined = undefined;
    const pageLimit = 200;
    const maxPages = 15;
    let page = 0;

    do {
      const res: any = await amplifyClient.models.Document.list({ limit: pageLimit, nextToken } as any);
      rows.push(...((res?.data ?? []) as any[]));
      nextToken = res?.nextToken;
      page++;
      if (page >= maxPages) break;
    } while (nextToken);

    const projected = rows
      .map((d) => {
        const id = asNumber((d as any).documentId ?? (d as any).id);
        const number = String((d as any).number ?? (d as any).documentNumber ?? '').trim();
        const date = String((d as any).date ?? '').trim();
        const total = asNumber((d as any).total) ?? 0;
        const note = String((d as any).note ?? (d as any).internalnote ?? '').trim();
        return { id, number, date, total, note };
      });

    const filtered = normalized.length >= 2
      ? projected
          .map((d) => {
            const haystack = normalizeSearch(`${d.number} ${d.note}`);
            const full = normalized && haystack.includes(normalized) ? 3 : 0;
            const tokenScore = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
            return { ...d, score: full + tokenScore };
          })
          .filter((d) => d.id && d.score > 0)
          .sort((a, b) => b.score - a.score)
      : projected.filter((d) => d.id);

    const matches = filtered
      .slice(0, 6)
      .map((d) => ({ id: Number(d.id), number: d.number, date: d.date, total: d.total }));

    return matches;
  } catch {
    return [];
  }
}

async function fetchWarehouseMatches(query: string): Promise<WarehouseMatch[]> {
  const normalized = normalizeSearch(query);
  const tokens = tokenizeSearch(query);
  try {
    const rows: any[] = [];
    let nextToken: string | null | undefined = undefined;
    const pageLimit = 100;
    const maxPages = 10;
    let page = 0;

    do {
      const res: any = await amplifyClient.models.Warehouse.list({ limit: pageLimit, nextToken } as any);
      rows.push(...((res?.data ?? []) as any[]));
      nextToken = res?.nextToken;
      page++;
      if (page >= maxPages) break;
    } while (nextToken);

    const projected = rows.map((w) => ({
      id: asNumber((w as any).idWarehouse),
      name: String((w as any).name ?? '').trim(),
    }));

    const filtered = normalized.length >= 2
      ? projected
          .map((w) => {
            const haystack = normalizeSearch(`${w.id ?? ''} ${w.name}`);
            const full = normalized && haystack.includes(normalized) ? 3 : 0;
            const tokenScore = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
            return { ...w, score: full + tokenScore };
          })
          .filter((w) => w.id && w.score > 0)
          .sort((a, b) => b.score - a.score)
      : projected.filter((w) => w.id);

    return filtered.slice(0, 6).map((w) => ({ id: Number(w.id), name: w.name }));
  } catch {
    return [];
  }
}

async function fetchKardexMatches(query: string): Promise<KardexMatch[]> {
  const normalized = normalizeSearch(query);
  const tokens = tokenizeSearch(query);
  try {
    const rows: any[] = [];
    let nextToken: string | null | undefined = undefined;
    const pageLimit = 250;
    const maxPages = 12;
    let page = 0;

    do {
      const res: any = await amplifyClient.models.Kardex.list({ limit: pageLimit, nextToken } as any);
      rows.push(...((res?.data ?? []) as any[]));
      nextToken = res?.nextToken;
      page++;
      if (page >= maxPages) break;
    } while (nextToken);

    const projected = rows.map((k) => {
      const id = asNumber((k as any).kardexId);
      const type = String((k as any).type ?? '').trim();
      const date = String((k as any).date ?? '').trim();
      const quantity = asNumber((k as any).quantity) ?? 0;
      const productId = asNumber((k as any).productId);
      const warehouseId = asNumber((k as any).warehouseId);
      const note = String((k as any).note ?? '').trim();
      const documentNumber = String((k as any).documentNumber ?? '').trim();
      return { id, type, date, quantity, productId, warehouseId, note, documentNumber };
    });

    const filtered = normalized.length >= 2
      ? projected
          .map((k) => {
            const haystack = normalizeSearch(`${k.type} ${k.note} ${k.documentNumber} ${k.productId ?? ''} ${k.warehouseId ?? ''}`);
            const full = normalized && haystack.includes(normalized) ? 3 : 0;
            const tokenScore = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
            return { ...k, score: full + tokenScore };
          })
          .filter((k) => k.id && k.score > 0)
          .sort((a, b) => b.score - a.score)
      : projected.filter((k) => k.id);

    return filtered
      .slice(0, 8)
      .map((k) => ({
        id: Number(k.id),
        type: k.type,
        date: k.date,
        quantity: k.quantity,
        productId: k.productId,
        warehouseId: k.warehouseId,
      }));
  } catch {
    return [];
  }
}

async function searchWeb(query: string, enabled: boolean): Promise<WebResult[]> {
  if (!enabled || !query || query.length < 3) return [];
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return [];
    const payload = (await res.json()) as [string, string[], string[], string[]];
    const titles = Array.isArray(payload?.[1]) ? payload[1] : [];
    const snippets = Array.isArray(payload?.[2]) ? payload[2] : [];
    const links = Array.isArray(payload?.[3]) ? payload[3] : [];

    const out: WebResult[] = [];
    for (let i = 0; i < Math.min(links.length, 5); i++) {
      const link = String(links[i] ?? '').trim();
      if (!link) continue;
      out.push({
        title: String(titles[i] ?? 'Resultado web').trim() || 'Resultado web',
        snippet: String(snippets[i] ?? '').trim(),
        url: link,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function buildAttachmentText(attachments: IncomingAttachment[]): string {
  const parts: string[] = [];
  for (const a of attachments) {
    const name = a.name ? `Archivo: ${a.name}` : 'Archivo adjunto';
    if (a.kind === 'text' || a.kind === 'document') {
      const text = String(a.text ?? '').trim();
      if (text) {
        parts.push(`${name}\n${text.slice(0, 4000)}`);
      }
    }
  }
  return parts.join('\n\n').slice(0, 12000);
}

function buildActionProposals(
  message: string,
  products: ProductMatch[],
  documents: DocumentMatch[],
  warehouses: WarehouseMatch[],
  kardex: KardexMatch[]
): ActionProposal[] {
  const q = message.toLowerCase();
  const actions: ActionProposal[] = [];

  const firstProduct = products[0];
  const firstDocument = documents[0];
  const firstWarehouse = warehouses[0];
  const firstKardex = kardex[0];

  if (firstProduct) {
    actions.push({
      id: `open-product-${firstProduct.id}`,
      kind: 'navigate',
      title: `Abrir producto ${firstProduct.code || firstProduct.name}`,
      description: 'Ir directamente al módulo de inventario filtrado por este producto.',
      requiresConfirmation: false,
      link: {
        label: `Ver producto ${firstProduct.code || firstProduct.name}`,
        url: `/inventory?q=${encodeURIComponent(String(firstProduct.code || firstProduct.name))}`,
      },
    });
  }

  if (firstDocument) {
    actions.push({
      id: `open-document-${firstDocument.id}`,
      kind: 'navigate',
      title: `Abrir documento ${firstDocument.number || firstDocument.id}`,
      description: 'Abrir el PDF del documento sugerido.',
      requiresConfirmation: false,
      link: {
        label: `Ver documento ${firstDocument.number || firstDocument.id}`,
        url: `/documents/${firstDocument.id}/pdf`,
      },
    });
  }

  if (firstWarehouse) {
    actions.push({
      id: `open-warehouse-${firstWarehouse.id}`,
      kind: 'navigate',
      title: `Abrir bodega ${firstWarehouse.name || firstWarehouse.id}`,
      description: 'Ir al modulo de stock filtrado por esta bodega.',
      requiresConfirmation: false,
      link: {
        label: `Ver stock bodega ${firstWarehouse.name || firstWarehouse.id}`,
        url: `/stock?warehouseId=${firstWarehouse.id}`,
      },
    });
  }

  if (firstKardex) {
    actions.push({
      id: `open-kardex-${firstKardex.id}`,
      kind: 'navigate',
      title: `Abrir kardex relacionado #${firstKardex.id}`,
      description: 'Navegar al modulo Kardex para revisar movimientos asociados.',
      requiresConfirmation: false,
      link: {
        label: 'Ver modulo Kardex',
        url: '/kardex',
      },
    });
  }

  if (/(crear|agregar).*(producto|documento|stock)/i.test(q)) {
    actions.push({
      id: 'propose-create',
      kind: 'write',
      title: 'Proponer creación de registro',
      description: 'Antes de escribir datos en el sistema, se pedirá confirmación explícita del usuario.',
      requiresConfirmation: true,
      requiresDoubleConfirmation: true,
      execute: {
        operation: 'createProduct',
        params: {
          name: `Nuevo producto IA (${new Date().toISOString().slice(0, 10)})`,
        },
      },
    });
  }

  if (/(editar|modificar|ajustar|actualizar)/i.test(q)) {
    actions.push({
      id: 'propose-update',
      kind: 'write',
      title: 'Proponer modificación de datos',
      description: 'La IA puede preparar cambios sugeridos y aplicarlos solo con aprobación del usuario.',
      requiresConfirmation: true,
      execute: firstProduct
        ? {
            operation: 'adjustStock',
            params: {
              productId: firstProduct.id,
              warehouseId: 1,
              quantity: firstProduct.stock ?? 0,
              reason: 'Ajuste asistido por IA (requiere validación humana)',
            },
          }
        : undefined,
    });
  }

  if (/(eliminar|borrar|anular)/i.test(q)) {
    actions.push({
      id: 'propose-delete',
      kind: 'write',
      title: 'Proponer eliminación/anulación',
      description: 'Las acciones destructivas requieren doble confirmación.',
      requiresConfirmation: true,
      requiresDoubleConfirmation: true,
    });
  }

  return actions;
}

function buildSystemPrompt(
  context?: Record<string, unknown>,
  dbContext?: {
    products: ProductMatch[];
    documents: DocumentMatch[];
    warehouses: WarehouseMatch[];
    kardex: KardexMatch[];
  },
  webResults?: WebResult[]
): string {
  const totalProducts = typeof context?.totalProducts === 'string' ? context.totalProducts : '1.243+';
  const currentModule = typeof context?.currentModule === 'string' ? context.currentModule : 'general';
  const currentPath = typeof context?.currentPath === 'string' ? context.currentPath : '/';

  const productsInline = (dbContext?.products ?? [])
    .map((p) => `${p.code || '(sin-codigo)'} - ${p.name}`)
    .join(' | ')
    .slice(0, 1200);

  const docsInline = (dbContext?.documents ?? [])
    .map((d) => `Doc ${d.number || d.id} (${d.date || 'sin-fecha'}) total ${d.total}`)
    .join(' | ')
    .slice(0, 1200);

  const warehousesInline = (dbContext?.warehouses ?? [])
    .map((w) => `Bodega ${w.id}: ${w.name}`)
    .join(' | ')
    .slice(0, 1200);

  const kardexInline = (dbContext?.kardex ?? [])
    .map((k) => `Kardex ${k.id} tipo ${k.type} fecha ${k.date} qty ${k.quantity}`)
    .join(' | ')
    .slice(0, 1200);

  const webInline = (webResults ?? [])
    .map((r) => `${r.title}: ${r.url}`)
    .join(' | ')
    .slice(0, 1200);

  return [
    'Eres el asistente interno de TRACTO AGRICOLA dentro del sistema InventoryTW.',
    `Gestionas un inventario de ${totalProducts} productos.`,
    `Contexto actual: modulo=${currentModule}, ruta=${currentPath}.`,
    'Responde en espanol claro y concreto.',
    'Puedes usar el contexto de base de datos y resultados web provistos por el backend.',
    'Ayuda con inventario, productos, grupos, documentos, compras, ventas, kardex y operacion del sistema.',
    'No digas que no tienes acceso a base de datos; en su lugar indica si no hubo coincidencias en la consulta del backend.',
    'No inventes datos, stock, precios ni resultados de documentos.',
    'Prioriza respuestas utiles, cortas y accionables.',
    productsInline ? `Productos candidatos encontrados: ${productsInline}` : '',
    docsInline ? `Documentos candidatos encontrados: ${docsInline}` : '',
    warehousesInline ? `Bodegas candidatas encontradas: ${warehousesInline}` : '',
    kardexInline ? `Movimientos kardex candidatos: ${kardexInline}` : '',
    webInline ? `Resultados web sugeridos: ${webInline}` : '',
  ].join(' ');
}

function buildBedrockClient(): BedrockRuntimeClient {
  const accessKeyId = readEnv('BEDROCK_ACCESS_KEY_ID');
  const secretAccessKey = readEnv('BEDROCK_SECRET_ACCESS_KEY');
  const region = readEnv('AI_BEDROCK_REGION') ?? 'us-east-2';

  if (!accessKeyId || !secretAccessKey) {
    throw Object.assign(
      new Error(
        'Credenciales Bedrock no configuradas. ' +
        'Agrega BEDROCK_ACCESS_KEY_ID y BEDROCK_SECRET_ACCESS_KEY en Amplify Console → Environment variables.'
      ),
      { errorType: 'MISSING_CREDENTIALS' }
    );
  }

  return new BedrockRuntimeClient({ region, credentials: { accessKeyId, secretAccessKey } });
}

async function invokeModel(
  messages: ChatMessage[],
  context?: Record<string, unknown>,
  dbContext?: {
    products: ProductMatch[];
    documents: DocumentMatch[];
    warehouses: WarehouseMatch[];
    kardex: KardexMatch[];
  },
  webResults?: WebResult[],
  attachments?: IncomingAttachment[]
): Promise<string> {
  const client = buildBedrockClient();
  const primaryModelId =
    readEnv('AI_MODEL_PRIMARY') ??
    readEnv('AI_MODEL') ??
    'anthropic.claude-3-haiku-20240307-v1:0';
  const visionModelId = readEnv('AI_MODEL_VISION') ?? primaryModelId;
  const maxTokens = Number(readEnv('AI_MAX_TOKENS') ?? '1024');

  const attachmentText = buildAttachmentText(attachments ?? []);
  const imageAttachments = (attachments ?? []).filter((a) => a.kind === 'image' && a.dataUrl).slice(0, 2);

  const buildMessageBlocks = (includeImages: boolean) => {
    return messages.map((message) => {
      const content: any[] = [{ text: message.content }];

      if (message.role === 'user' && attachmentText) {
        content.push({ text: `Contexto de archivos adjuntos:\n${attachmentText}` });
      }

      if (includeImages && message.role === 'user') {
        for (const img of imageAttachments) {
          const parsed = parseDataUrl(String(img.dataUrl));
          if (!parsed) continue;
          const format = imageFormatFromMime(parsed.mime);
          if (!format) continue;
          content.push({
            image: {
              format,
              source: { bytes: parsed.bytes },
            },
          });
        }
      }

      return { role: message.role, content };
    });
  };

  const runConverse = async (modelId: string, includeImages: boolean): Promise<string> => {
    const command = new ConverseCommand({
      modelId,
      system: [{ text: buildSystemPrompt(context, dbContext, webResults) }],
      messages: buildMessageBlocks(includeImages),
      inferenceConfig: {
        maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 1024,
      },
    });

    const result = await client.send(command);
    const text = result.output?.message?.content
      ?.map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (!text) throw new Error('Bedrock respondió vacío');
    return text;
  };

  const hasImages = imageAttachments.length > 0;
  const modelForAttempt = hasImages ? visionModelId : primaryModelId;

  try {
    return await runConverse(modelForAttempt, hasImages);
  } catch (error: any) {
    const msg = String(error?.message ?? '');
    const isImageUnsupported = /image content block|doesn't support the image|no support for image/i.test(msg);

    if (hasImages && isImageUnsupported) {
      const textOnly = await runConverse(primaryModelId, false);
      return `${textOnly}\n\nNota: El modelo actual no soporta imágenes en este endpoint. Se procesó solo texto/adjuntos extraídos.`;
    }

    throw error;
  }
}

function errorResponse(message: string, errorType: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message, errorType }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Formato 1: { message, context } → respuesta JSON (página /ai-lab) ──
    if (typeof body?.message === 'string') {
      const message = body.message.trim();
      if (!message) return errorResponse('El mensaje está vacío', 'EMPTY_MESSAGE', 400);

      const context = (typeof body?.context === 'object' && body?.context) ? body.context as Record<string, unknown> : {};
      const attachments = sanitizeAttachments(body?.attachments);
      const history = sanitizeMessages(body?.history);

      const [products, documents, warehouses, kardexEntries, webResults] = await Promise.all([
        fetchProductMatches(message),
        fetchDocumentMatches(message),
        fetchWarehouseMatches(message),
        fetchKardexMatches(message),
        searchWeb(message, Boolean(body?.enableWeb)),
      ]);

      const messages: ChatMessage[] = [
        ...history,
        { role: 'user' as const, content: message.slice(0, 3000) },
      ].slice(-16);
      const text = await invokeModel(
        messages,
        context,
        { products, documents, warehouses, kardex: kardexEntries },
        webResults,
        attachments
      );
      const modelId = readEnv('AI_MODEL_PRIMARY') ?? readEnv('AI_MODEL') ?? 'anthropic.claude-3-haiku-20240307-v1:0';

      const links: AssistantLink[] = [];
      for (const p of products) {
        const q = encodeURIComponent(String(p.code || p.name).trim());
        links.push({ label: `Producto: ${p.code || p.name}`, url: `/inventory?q=${q}` });
      }
      for (const d of documents) {
        links.push({ label: `Documento ${d.number || d.id}`, url: `/documents/${d.id}/pdf` });
      }
      for (const w of warehouses) {
        links.push({ label: `Bodega ${w.name || w.id}`, url: `/stock?warehouseId=${w.id}` });
      }
      for (const k of kardexEntries) {
        links.push({ label: `Kardex #${k.id} (${k.type || 'mov'})`, url: '/kardex' });
      }
      for (const w of webResults) {
        links.push({ label: `Web: ${w.title}`, url: w.url });
      }

      if (products.length === 0) {
        links.push({
          label: `Buscar "${message.slice(0, 40)}" en Inventario`,
          url: `/inventory?q=${encodeURIComponent(message)}`,
        });
      }

      if (documents.length === 0) {
        links.push({
          label: `Buscar "${message.slice(0, 40)}" en Documentos`,
          url: `/documents`,
        });
      }

      if (warehouses.length === 0) {
        links.push({
          label: `Revisar bodegas para "${message.slice(0, 40)}"`,
          url: '/warehouses',
        });
      }

      if (kardexEntries.length === 0) {
        links.push({
          label: `Revisar Kardex para "${message.slice(0, 40)}"`,
          url: '/kardex',
        });
      }

      const tables: AssistantTable[] = [];
      if (products.length > 0) {
        tables.push({
          title: 'Productos relacionados',
          columns: ['ID', 'Codigo', 'Producto', 'Stock'],
          rows: products.map((p) => [p.id, p.code || '-', p.name, p.stock ?? '-']),
        });
      }
      if (documents.length > 0) {
        tables.push({
          title: 'Documentos relacionados',
          columns: ['ID', 'Numero', 'Fecha', 'Total'],
          rows: documents.map((d) => [d.id, d.number || '-', d.date || '-', d.total]),
        });
      }

      if (warehouses.length > 0) {
        tables.push({
          title: 'Bodegas relacionadas',
          columns: ['ID', 'Bodega'],
          rows: warehouses.map((w) => [w.id, w.name || '-']),
        });
      }

      if (kardexEntries.length > 0) {
        tables.push({
          title: 'Movimientos Kardex relacionados',
          columns: ['ID', 'Tipo', 'Fecha', 'Cantidad', 'Producto', 'Bodega'],
          rows: kardexEntries.map((k) => [k.id, k.type || '-', k.date || '-', k.quantity, k.productId ?? '-', k.warehouseId ?? '-']),
        });
      }

      const actions = buildActionProposals(message, products, documents, warehouses, kardexEntries);

      return new Response(
        JSON.stringify({
          response: text,
          model: modelId,
          timestamp: new Date().toISOString(),
          links: links.slice(0, 10),
          tables,
          actions,
          sources: webResults,
          contextEcho: {
            currentModule: String(context?.currentModule ?? 'general'),
            currentPath: String(context?.currentPath ?? '/'),
            productsFound: products.length,
            documentsFound: documents.length,
            warehousesFound: warehouses.length,
            kardexFound: kardexEntries.length,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Formato 2: { messages: [...] } → stream text/plain (panel flotante) ──
    const messages = sanitizeMessages(body?.messages);
    if (messages.length === 0) {
      return errorResponse('No hay mensajes válidos en la solicitud', 'INVALID_INPUT', 400);
    }
    if (!messages[messages.length - 1]?.content) {
      return errorResponse('El mensaje del usuario está vacío', 'EMPTY_MESSAGE', 400);
    }

    const text = await invokeModel(messages, undefined, undefined, undefined, undefined);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let idx = 0;
        const chunkSize = 40;
        const interval = setInterval(() => {
          if (idx >= text.length) {
            clearInterval(interval);
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(text.slice(idx, idx + chunkSize)));
          idx += chunkSize;
        }, 40);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    const isCredErr = error?.errorType === 'MISSING_CREDENTIALS';
    return errorResponse(
      error?.message ?? 'Error desconocido',
      error?.errorType ?? 'INTERNAL_ERROR',
      isCredErr ? 503 : 500
    );
  }
}
