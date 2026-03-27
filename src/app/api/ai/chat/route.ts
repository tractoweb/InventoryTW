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
export const maxDuration = 55;

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

type ToolQueryDBInput = {
  table: string;
  columns?: string[];
  nameContains?: string;
  codeContains?: string;
  productId?: number;
  warehouseId?: number;
  documentId?: number;
  customerId?: number;
  clientId?: number;
  documentTypeId?: number;
  productGroupId?: number;
  taxId?: number;
  isEnabled?: boolean;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};
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
    operation:
      | 'adjustStock'
      | 'createProduct'
      | 'queryDB'
      | 'updateProduct'
      | 'deleteProduct'
      | 'updateDocumentMetadata';
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

function normalizeRef(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function extractReferenceCandidates(query: string): string[] {
  const raw = String(query ?? '');
  const rx = /[A-Za-z0-9][A-Za-z0-9.'\-/]{3,}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(raw)) !== null) {
    const normalized = normalizeRef(m[0]);
    if (normalized.length >= 4) out.add(normalized);
  }
  return Array.from(out).slice(0, 8);
}

function extractDocumentNumberCandidates(query: string): string[] {
  const raw = String(query ?? '');
  const rx = /[A-Za-z0-9]{1,6}[\-\/][A-Za-z0-9\-\/]{2,20}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(raw)) !== null) {
    const normalized = normalizeRef(m[0]);
    if (normalized.length >= 4) out.add(normalized);
  }
  return Array.from(out).slice(0, 8);
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
  const refCandidates = extractReferenceCandidates(query);
  const explicitRefSearch = refCandidates.length > 0;
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

    const stockRows: any[] = [];
    let stockNextToken: string | null | undefined = undefined;
    let stockPage = 0;
    const stockPageLimit = 300;
    const stockMaxPages = 30;

    do {
      const res: any = await amplifyClient.models.Stock.list({ limit: stockPageLimit, nextToken: stockNextToken } as any);
      stockRows.push(...((res?.data ?? []) as any[]));
      stockNextToken = res?.nextToken;
      stockPage++;
      if (stockPage >= stockMaxPages) break;
    } while (stockNextToken);

    const stockByProduct = new Map<number, number>();
    for (const s of stockRows) {
      const pid = asNumber((s as any).productId);
      const qty = asNumber((s as any).quantity);
      if (!pid || qty === null) continue;
      stockByProduct.set(pid, (stockByProduct.get(pid) ?? 0) + qty);
    }

    const projected = rows
      .map((p) => {
        const id = asNumber((p as any).idProduct ?? (p as any).productId);
        const code = String((p as any).code ?? (p as any).productCode ?? '').trim();
        const name = String((p as any).name ?? (p as any).productName ?? '').trim();
        const description = String((p as any).description ?? '').trim();
        const stockFallback = asNumber((p as any).stock);
        const stock = id ? (stockByProduct.get(Number(id)) ?? stockFallback) : stockFallback;
        const normalizedCode = normalizeRef(code);
        return { id, code, name, description, stock, normalizedCode };
      });

    const scored = normalized.length >= 2
      ? projected
          .map((p) => {
            const haystack = normalizeSearch(`${p.code} ${p.name} ${p.description}`);
            const full = normalized && haystack.includes(normalized) ? 3 : 0;
            const tokenScore = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);

            let refScore = 0;
            for (const ref of refCandidates) {
              if (!p.normalizedCode) continue;
              if (p.normalizedCode === ref) refScore = Math.max(refScore, 200);
              else if (p.normalizedCode.includes(ref) || ref.includes(p.normalizedCode)) refScore = Math.max(refScore, 80);
            }

            return { ...p, score: full + tokenScore + refScore, refScore };
          })
          .filter((p) => p.id && p.score > 0)
          .sort((a, b) => b.score - a.score)
      : projected.filter((p) => p.id).map((p) => ({ ...p, score: 1, refScore: 0 }));

    const bestExact = explicitRefSearch ? scored.filter((p) => p.refScore >= 200) : [];
    const filtered = bestExact.length > 0 ? bestExact : scored;

    const minScore = explicitRefSearch ? 8 : 1;

    const matches = filtered
      .filter((p) => (p.score ?? 0) >= minScore)
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
  const docCandidates = extractDocumentNumberCandidates(query);
  const refCandidates = extractReferenceCandidates(query);
  const explicitDocSearch = docCandidates.length > 0;
  const asksForDocuments = /(documento|documentos|doc\b|factura|boleta|comprobante|numero de documento|nro\b)/i.test(query);
  if (!asksForDocuments && !explicitDocSearch) return [];

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
        const normalizedNumber = normalizeRef(number);
        return { id, number, date, total, note, normalizedNumber };
      });

    const scored = normalized.length >= 2
      ? projected
          .map((d) => {
            const numberText = normalizeSearch(d.number);
            const noteText = normalizeSearch(d.note);
            const fullNumber = normalized && numberText.includes(normalized) ? 6 : 0;
            const fullNote = normalized && noteText.includes(normalized) ? 1 : 0;
            const tokenScore = tokens.reduce((acc, t) => acc + (numberText.includes(t) ? 2 : 0), 0);

            let exactDocScore = 0;
            const allDocRefs = [...docCandidates, ...refCandidates];
            for (const ref of allDocRefs) {
              if (!d.normalizedNumber) continue;
              if (d.normalizedNumber === ref) exactDocScore = Math.max(exactDocScore, 200);
              else if (d.normalizedNumber.includes(ref) || ref.includes(d.normalizedNumber)) exactDocScore = Math.max(exactDocScore, 40);
            }

            return { ...d, score: fullNumber + fullNote + tokenScore + exactDocScore, exactDocScore };
          })
          .filter((d) => d.id && d.score > 0)
          .sort((a, b) => b.score - a.score)
      : projected.filter((d) => d.id).map((d) => ({ ...d, score: 1, exactDocScore: 0 }));

    const exactDocs = explicitDocSearch ? scored.filter((d) => d.exactDocScore >= 200) : [];
    const filtered = exactDocs.length > 0 ? exactDocs : scored;

    const minScore = explicitDocSearch ? 10 : 2;

    const matches = filtered
      .filter((d) => (d.score ?? 0) >= minScore)
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

// ── Bedrock tool_use: queryDB inline executor ────────────────────────────────

const QUERY_ALLOWED_TABLES = new Set([
  'Product', 'Stock', 'Kardex', 'Document', 'DocumentItem',
  'Customer', 'Client', 'Warehouse', 'DocumentType', 'ProductGroup',
  'Tax', 'Payment', 'Barcode', 'ProductTax', 'DocumentItemTax',
]);
const QUERY_EXCLUDE_KEYS = new Set(['__typename', 'createdAt', 'updatedAt', 'nextToken']);
const QUERY_EXCLUDE_RELATIONS = new Set([
  'productGroup', 'barcodes', 'stocks', 'stockControls', 'documentItems',
  'comments', 'taxes', 'kardexEntries', 'kardexHistories', 'warehouse',
  'product', 'document', 'customer', 'client', 'documentType', 'user',
  'paymentType', 'tax', 'documentCategory', 'children', 'payments', 'auditLogs',
]);

function isGarbageValue(v: unknown): boolean {
  if (typeof v === 'function') return true;
  if (typeof v === 'string' && v.length > 20 &&
      (v.startsWith('n=>') || v.startsWith('e=>') || v.includes('=>t['))) return true;
  return false;
}

async function executeQueryDBToolInline(input: ToolQueryDBInput): Promise<{
  ok: boolean; table?: AssistantTable; rowCount: number; message: string;
}> {
  if (!QUERY_ALLOWED_TABLES.has(input.table))
    return { ok: false, rowCount: 0, message: `Tabla no permitida: ${input.table}` };

  const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 100);
  const clauses: any[] = [];
  if (input.productId !== undefined)      clauses.push({ productId:      { eq: input.productId } });
  if (input.warehouseId !== undefined)    clauses.push({ warehouseId:    { eq: input.warehouseId } });
  if (input.documentId !== undefined)     clauses.push({ documentId:     { eq: input.documentId } });
  if (input.customerId !== undefined)     clauses.push({ customerId:     { eq: input.customerId } });
  if (input.clientId !== undefined)       clauses.push({ clientId:       { eq: input.clientId } });
  if (input.documentTypeId !== undefined) clauses.push({ documentTypeId: { eq: input.documentTypeId } });
  if (input.productGroupId !== undefined) clauses.push({ productGroupId: { eq: input.productGroupId } });
  if (input.taxId !== undefined)          clauses.push({ taxId:          { eq: input.taxId } });
  if (input.isEnabled !== undefined)      clauses.push({ isEnabled:      { eq: input.isEnabled } });
  if (input.type)                         clauses.push({ type:           { eq: input.type } });
  if (input.nameContains)                 clauses.push({ name:           { contains: input.nameContains } });
  if (input.codeContains)                 clauses.push({ code:           { contains: input.codeContains } });
  if (input.dateFrom && input.dateTo)     clauses.push({ date:           { between: [input.dateFrom, input.dateTo] } });
  else if (input.dateFrom)               clauses.push({ date:           { ge: input.dateFrom } });
  else if (input.dateTo)                 clauses.push({ date:           { le: input.dateTo } });

  const filter = clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : { and: clauses };
  const model = (amplifyClient.models as any)[input.table];
  if (!model) return { ok: false, rowCount: 0, message: `Modelo no disponible: ${input.table}` };

  const res: any = await model.list({ ...(filter ? { filter } : {}), limit });
  const rows: any[] = res?.data ?? [];
  if (rows.length === 0)
    return { ok: true, rowCount: 0, message: `Sin resultados en ${input.table} con los filtros aplicados.` };

  let allColumns = Object.keys(rows[0]).filter((k) =>
    !QUERY_EXCLUDE_KEYS.has(k) && !k.startsWith('_') &&
    !QUERY_EXCLUDE_RELATIONS.has(k) && !isGarbageValue(rows[0][k])
  );
  if (input.columns?.length) {
    const avail = new Set(allColumns);
    const proj = input.columns.filter((c) => avail.has(c));
    if (proj.length > 0) allColumns = proj;
  }
  const tableRows: Array<Array<string | number>> = rows.map((row: any) =>
    allColumns.map((col) => {
      const v = row[col];
      if (v === null || v === undefined) return '-';
      if (isGarbageValue(v)) return '-';
      if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
      return String(v);
    })
  );
  return {
    ok: true, rowCount: rows.length,
    message: `${rows.length} registro(s) en ${input.table}.`,
    table: { title: `${input.table} — ${rows.length} resultado(s)`, columns: allColumns, rows: tableRows },
  };
}

const QUERY_DB_TOOL_SPEC = {
  toolSpec: {
    name: 'queryDB',
    description:
      'Consulta la base de datos real de InventoryTW. ' +
      'ÚSALO SIEMPRE que el usuario pida ver, listar, buscar o consultar datos reales. ' +
      'Usa columns[] para mostrar SOLO las columnas que el usuario necesita. ' +
      'Usa nameContains para buscar por nombre parcial, codeContains para código parcial. ' +
      'Columnas de Product: idProduct,name,code,plu,price,cost,markup,productGroupId,isEnabled,measurementUnit,lastPurchasePrice. ' +
      'Columnas de Stock: productId,warehouseId,quantity. ' +
      'Columnas de Kardex: kardexId,productId,warehouseId,date,type,quantity,balance,unitCost,totalCost,documentNumber,note. ' +
      'Columnas de Document: documentId,number,date,total,customerId,clientId,warehouseId,documentTypeId,paidStatus,note. ' +
      'Columnas de DocumentItem: documentItemId,documentId,productId,quantity,price,discount,total,productNameSnapshot,productCodeSnapshot. ' +
      'Columnas de Customer: idCustomer,name,taxNumber,code,isEnabled. ' +
      'Columnas de Client: idClient,name,taxNumber,email,phoneNumber,isEnabled. ' +
      'Columnas de Warehouse: idWarehouse,name. ' +
      'Columnas de ProductGroup: idProductGroup,name,parentGroupId. ' +
      'Columnas de Payment: paymentId,documentId,paymentTypeId,amount,date.',
    inputSchema: {
      json: {
        type: 'object' as const,
        properties: {
          table: {
            type: 'string',
            enum: ['Product','Stock','Kardex','Document','DocumentItem','Customer','Client',
                   'Warehouse','DocumentType','ProductGroup','Tax','Payment','Barcode','ProductTax','DocumentItemTax'],
            description: 'Tabla a consultar',
          },
          columns: { type: 'array', items: { type: 'string' }, description: 'Columnas a mostrar (solo las que pide el usuario)' },
          nameContains: { type: 'string', description: 'Búsqueda parcial en campo name' },
          codeContains: { type: 'string', description: 'Búsqueda parcial en campo code' },
          productId:     { type: 'number', description: 'ID exacto de producto' },
          warehouseId:   { type: 'number', description: 'ID de bodega' },
          documentId:    { type: 'number', description: 'ID de documento' },
          customerId:    { type: 'number', description: 'ID de proveedor/cliente' },
          clientId:      { type: 'number', description: 'ID de cliente final' },
          documentTypeId:  { type: 'number', description: 'ID de tipo de documento' },
          productGroupId:  { type: 'number', description: 'ID de grupo de producto' },
          taxId:           { type: 'number', description: 'ID de impuesto' },
          isEnabled:       { type: 'boolean', description: 'true=activos, false=inactivos' },
          type:            { type: 'string', description: 'Tipo en Kardex: ENTRADA, SALIDA o AJUSTE' },
          dateFrom:        { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
          dateTo:          { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
          limit:           { type: 'number', description: 'Filas a recuperar 1-100 (default 20)' },
        },
        required: ['table'],
      },
    },
  },
};

async function invokeModelWithToolLoop(
  messages: ChatMessage[],
  context?: Record<string, unknown>,
  dbContext?: { products: ProductMatch[]; documents: DocumentMatch[]; warehouses: WarehouseMatch[]; kardex: KardexMatch[] },
  webResults?: WebResult[],
  attachments?: IncomingAttachment[]
): Promise<{ text: string; toolTables: AssistantTable[] }> {
  const client = buildBedrockClient();
  const modelId = readEnv('AI_MODEL_PRIMARY') ?? readEnv('AI_MODEL') ?? 'anthropic.claude-3-haiku-20240307-v1:0';
  const maxTokens = Number(readEnv('AI_MAX_TOKENS') ?? '1024');
  const systemPrompt = buildSystemPrompt(context, dbContext, webResults);
  const attachmentText = buildAttachmentText(attachments ?? []);
  const toolTables: AssistantTable[] = [];
  const imageAttachments = (attachments ?? []).filter((a) => a.kind === 'image' && a.dataUrl).slice(0, 2);
  const inferConf = { maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 1024 };

  const bedrockMsgs: any[] = messages.map((m, idx) => {
    const isLastUser = idx === messages.length - 1 && m.role === 'user';
    const content: any[] = [{ text: m.content }];
    if (isLastUser && attachmentText) content.push({ text: `Archivos adjuntos:\n${attachmentText}` });
    if (isLastUser) {
      for (const img of imageAttachments) {
        const parsed = parseDataUrl(String(img.dataUrl));
        if (!parsed) continue;
        const format = imageFormatFromMime(parsed.mime);
        if (!format) continue;
        content.push({ image: { format, source: { bytes: parsed.bytes } } });
      }
    }
    return { role: m.role, content };
  });

  // ── Primera llamada: Claude puede llamar queryDB ─────────────────────────
  const cmd1 = new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: bedrockMsgs as any,
    toolConfig: { tools: [QUERY_DB_TOOL_SPEC as any] } as any,
    inferenceConfig: inferConf,
  });
  const res1 = await client.send(cmd1);
  const assistantContent1: any[] = res1.output?.message?.content ?? [];
  const toolUseBlocks = assistantContent1.filter((b: any) => b.toolUse);

  if (res1.stopReason === 'tool_use' && toolUseBlocks.length > 0) {
    const toolResultBlocks: any[] = [];
    for (const block of toolUseBlocks) {
      const { toolUseId, name, input } = block.toolUse as {
        toolUseId: string; name: string; input: ToolQueryDBInput;
      };
      if (name === 'queryDB') {
        let resultText: string;
        try {
          const result = await executeQueryDBToolInline(input);
          if (result.table) toolTables.push(result.table);
          resultText = result.table
            ? `[DATOS REALES de ${input.table}] ${result.message}\n` +
              `Columnas: ${result.table.columns.join(', ')}\n` +
              result.table.rows.map((r) =>
                result.table!.columns.map((c, i) => `${c}=${r[i]}`).join(' | ')
              ).join('\n')
            : `[Sin resultados] ${result.message}`;
        } catch (err: any) {
          resultText = `Error en queryDB(${input.table}): ${err?.message ?? 'desconocido'}`;
        }
        toolResultBlocks.push({
          toolResult: { toolUseId, content: [{ text: resultText }], status: 'success' },
        });
      }
    }
    if (toolResultBlocks.length > 0) {
      // ── Segunda llamada: Claude recibe datos reales y redacta respuesta ──
      const msgs2: any[] = [
        ...bedrockMsgs,
        { role: 'assistant', content: assistantContent1 },
        { role: 'user', content: toolResultBlocks },
      ];
      const cmd2 = new ConverseCommand({
        modelId, system: [{ text: systemPrompt }],
        messages: msgs2, inferenceConfig: inferConf,
      });
      const res2 = await client.send(cmd2);
      const text2 = (res2.output?.message?.content ?? [])
        .map((p: any) => (typeof p.text === 'string' ? p.text : ''))
        .join('').trim();
      return { text: text2 || 'Consulta ejecutada.', toolTables };
    }
  }

  // ── Sin tool_use: respuesta directa de texto ─────────────────────────────
  const text = assistantContent1
    .map((p: any) => (typeof p.text === 'string' ? p.text : ''))
    .join('').trim();
  return { text: text || '(sin respuesta)', toolTables };
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

  if (firstWarehouse && /(bodega|almacen|almacén|warehouse)/i.test(q)) {
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

  if (firstKardex && /(kardex|movimiento|historial|entrada|salida)/i.test(q)) {
    actions.push({
      id: `open-kardex-${firstKardex.id}`,
      kind: 'navigate',
      title: `Abrir kardex relacionado #${firstKardex.id}`,
      description: 'Navegar al modulo Kardex para revisar movimientos asociados.',
      requiresConfirmation: false,
      link: { label: 'Ver modulo Kardex', url: '/kardex' },
    });
  }

  // ── Consultas de lectura (queryDB) ───────────────────────────────────────
  const asksForStock = /(stock|inventario|cantidad|existencia|disponib)/i.test(q);
  const asksForKardex = /(kardex|movimientos|historial|entradas|salidas)/i.test(q);
  const asksForDocItems = /(lineas|items|detalle.*documento|que tiene.*doc)/i.test(q);
  // ── Etiquetas ─────────────────────────────────────────────────────────────
      id: `print-label-${firstProduct.id}`,
      kind: 'navigate',
      title: `Preparar impresión de etiqueta: ${firstProduct.code || firstProduct.name}`,
      description: 'Abrir el módulo de impresión para confirmar formato, cantidad y dispositivo.',
      requiresConfirmation: true,
      link: {
        label: 'Abrir impresión de etiquetas',
        url: `/print-labels/products?q=${printableRef}`,
      },
    });
  }

  // ── Escritura ─────────────────────────────────────────────────────────────
  if (/(crear|agregar|nuevo)\s+(producto|articulo)/i.test(q)) {
    actions.push({
      id: 'propose-create-product',
      kind: 'write',
      title: 'Crear nuevo producto',
      description: 'Antes de crear el registro, confirma nombre, código, precio y grupo de producto.',
      requiresConfirmation: true,
      requiresDoubleConfirmation: true,
      execute: {
        operation: 'createProduct',
        params: { name: `Nuevo producto IA (${new Date().toISOString().slice(0, 10)})` },
      },
    });
  }

  if (/(editar|modificar|cambiar|actualizar).*(producto|precio|costo|nombre)/i.test(q) && firstProduct) {
    actions.push({
      id: `propose-update-product-${firstProduct.id}`,
      kind: 'write',
      title: `Modificar producto "${firstProduct.code || firstProduct.name}"`,
      description: 'La IA preparará un parche con solo los campos que mencionaste. Se pedirá confirmación.',
      requiresConfirmation: true,
      execute: {
        operation: 'updateProduct',
        params: { productId: firstProduct.id },
      },
    });
  }

  if (/(ajustar|corregir|actualizar)\s+stock/i.test(q) && firstProduct) {
    actions.push({
      id: `propose-adjust-stock-${firstProduct.id}`,
      kind: 'write',
      title: `Ajustar stock de "${firstProduct.code || firstProduct.name}"`,
      description: 'Ajuste absoluto de inventario. Se pedirá confirmación con la cantidad nueva.',
      requiresConfirmation: true,
      execute: {
        operation: 'adjustStock',
        params: {
          productId: firstProduct.id,
          warehouseId: firstWarehouse?.id ?? 1,
          quantity: firstProduct.stock ?? 0,
          reason: 'Ajuste asistido por IA (requiere validación humana)',
        },
      },
    });
  }

  if (/(eliminar|borrar|desactivar|anular)\s+(el\s+)?(producto|articulo)/i.test(q) && firstProduct) {
    actions.push({
      id: `propose-delete-product-${firstProduct.id}`,
      kind: 'write',
      title: `Desactivar producto "${firstProduct.code || firstProduct.name}"`,
      description: 'El producto quedará inactivo. No se elimina físicamente — permanece en kardex e historial.',
      requiresConfirmation: true,
      requiresDoubleConfirmation: true,
      execute: {
        operation: 'deleteProduct',
        params: { productId: firstProduct.id },
      },
    });
  }

  if (/(editar|modificar|actualizar).*(nota|comentario|cliente).*documento|documento.*(nota|cliente)/i.test(q) && firstDocument) {
    actions.push({
      id: `propose-update-doc-${firstDocument.id}`,
      kind: 'write',
      title: `Editar metadatos del documento ${firstDocument.number || firstDocument.id}`,
      description: 'Permite actualizar nota, nombre de cliente o vínculos de cliente/proveedor del documento.',
      requiresConfirmation: true,
      execute: {
        operation: 'updateDocumentMetadata',
        params: { documentId: firstDocument.id },
      },
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
  const pageSnapshot = typeof context?.pageSnapshot === 'string' ? context.pageSnapshot.slice(0, 2200) : '';

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

  const dbSchema = `
ESQUEMA DE BASE DE DATOS (InventoryTW — AWS DynamoDB via Amplify):
Tablas principales y sus campos clave:
- Product: idProduct, name, code, plu, price, cost, markup, productGroupId, isEnabled, measurementUnit, description, isService, lastPurchasePrice
- Stock: productId (FK→Product), warehouseId (FK→Warehouse), quantity [CLAVE COMPUESTA productId+warehouseId]
- Warehouse: idWarehouse, name
- ProductGroup: idProductGroup, name, parentGroupId, color, rank
- Barcode: productId (FK→Product), value [CLAVE COMPUESTA productId+value]
- ProductTax: productId (FK→Product), taxId (FK→Tax) [tabla de relacion N:N]
- Tax: idTax, name, rate, code, isFixed, isEnabled
- StockControl: stockControlId, productId, reorderPoint, preferredQuantity, isLowStockWarningEnabled, lowStockWarningQuantity
- Kardex: kardexId, productId (FK→Product), warehouseId (FK→Warehouse), documentId (FK→Document), documentItemId, date, type (ENTRADA/SALIDA/AJUSTE), quantity, balance, unitCost, totalCost, unitPrice, documentNumber note
  GSI disponibles: listKardexByProductId(productId), listKardexByWarehouseId(warehouseId), listKardexByDocumentId(documentId)
- KardexHistory: kardexHistoryId, kardexId, productId, previousBalance, newBalance, modifiedBy, modifiedDate, reason
- Document: documentId, number, date, total, userId (FK→User), customerId (FK→Customer), clientId (FK→Client), warehouseId (FK→Warehouse), documentTypeId (FK→DocumentType), paidStatus, note, dueDate, discount, isClockedOut
- DocumentItem: documentItemId, documentId (FK→Document), productId (FK→Product), quantity, price, discount, total, productNameSnapshot, productCodeSnapshot
- DocumentItemTax: documentItemId (FK→DocumentItem), taxId (FK→Tax), amount
- DocumentType: documentTypeId, name, code, documentCategoryId, warehouseId, stockDirection (1=ENTRADA, -1=SALIDA, 0=NINGUNO)
- DocumentCategory: idDocumentCategory, name
- Customer: idCustomer, name, taxNumber, code, isEnabled, isSupplier, isCustomer (usado para PROVEEDORES en InventoryTW)
- Client: idClient, name, taxNumber, email, phoneNumber, isEnabled (usado para CLIENTES finales de ventas)
- Payment: paymentId, documentId (FK→Document), paymentTypeId (FK→PaymentType), amount, date, userId
- PaymentType: paymentTypeId, name, code, isFiscal, isEnabled
- AuditLog: logId, userId, action, tableName, recordId, oldValues, newValues, timestamp
- Counter: name, value (secuencias autoincrement)
- ApplicationSettings: companyId, organizationName, taxPercentage, currencySymbol, allowNegativeStock, defaultWarehouseId
- PrintLabelRequest: requestId, requestedAt, status (PENDING/DONE)
- PrintLabelRequestItem: requestItemId, requestId, productId, qty, name, primaryBarcode

RELACIONES CLAVE:
- Un Product pertenece a un ProductGroup (productGroupId)
- Stock une Product + Warehouse (clave compuesta); SUM(Stock.quantity) por productId = stock total del producto
- Un Document tiene muchos DocumentItems; cada item apunta a un Product
- Kardex registra cada movimiento de inventario: ENTRADA (compra), SALIDA (venta), AJUSTE
- Customer = proveedores; Client = clientes finales de venta
- DocumentType.stockDirection define si un doc suma (1), resta (-1) o no afecta (0) el stock
`;

  const operationsDoc = `
OPERACIONES DISPONIBLES QUE PUEDES PROPONER (via campo "execute" en las acciones):

=== LECTURA (kind:"analysis", requiresConfirmation:false) ===
operation: "queryDB"
  Ejecuta una consulta filtrada sobre cualquier tabla. Devuelve los datos como tabla.
  Params: {
    table: "Product"|"Stock"|"Kardex"|"Document"|"DocumentItem"|"Customer"|"Client"|
           "Warehouse"|"DocumentType"|"ProductGroup"|"Tax"|"Payment"|"Barcode"|"ProductTax"|"DocumentItemTax",
    productId?: number,       // filtra por productId en Stock, Kardex, DocumentItem, Barcode, ProductTax
    warehouseId?: number,     // filtra por warehouseId en Stock, Kardex, Document
    documentId?: number,      // filtra por documentId en DocumentItem, Payment, Kardex
    customerId?: number,      // filtra por customerId en Document
    clientId?: number,        // filtra por clientId en Document
    documentTypeId?: number,  // filtra por documentTypeId en Document
    productGroupId?: number,  // filtra por productGroupId en Product
    taxId?: number,           // filtra por taxId en ProductTax, DocumentItemTax
    isEnabled?: boolean,      // filtra por isEnabled en Product, Customer
    type?: string,            // filtra por type en Kardex (ej: "ENTRADA", "SALIDA", "AJUSTE")
    dateFrom?: string,        // ej: "2026-01-01" — aplica a date en Kardex y Document
    dateTo?: string,          // ej: "2026-03-31"
    limit?: number            // 1-100, default 50
  }
  Ejemplos de uso:
    Ver stock de producto 123: { table:"Stock", productId:123 }
    Ver kardex de producto 45, solo entradas: { table:"Kardex", productId:45, type:"ENTRADA", limit:20 }
    Ver kardex de bodega 2 en enero 2026: { table:"Kardex", warehouseId:2, dateFrom:"2026-01-01", dateTo:"2026-01-31" }
    Ver documentos de cliente 7: { table:"Document", clientId:7, limit:20 }
    Ver items de documento 500: { table:"DocumentItem", documentId:500 }
    Ver todos los productos del grupo 3: { table:"Product", productGroupId:3, limit:100 }
    Ver pagos de documento 200: { table:"Payment", documentId:200 }
    Ver codigos de barra del producto 10: { table:"Barcode", productId:10 }
    Ver impuestos del producto 10: { table:"ProductTax", productId:10 }
    Ver todos los tipos de documento: { table:"DocumentType", limit:50 }

=== ESCRITURA (requieren AI_ENABLE_WRITE_ACTIONS=true en servidor) ===

operation: "adjustStock" (kind:"write", requiresConfirmation:true)
  Ajusta el stock absoluto de un producto en una bodega.
  Params: { productId:number, warehouseId:number, quantity:number, reason?:string }
  Nivel de acceso requerido: CASHIER (nivel 0+)
  Ejemplo: { productId:123, warehouseId:1, quantity:50, reason:"Conteo físico marzo 2026" }

operation: "createProduct" (kind:"write", requiresDoubleConfirmation:true)
  Crea un nuevo producto en el catálogo.
  Params: { name:string, code?:string, cost?:number, price?:number, productGroupId?:number }
  Nivel de acceso requerido: ADMIN (nivel 1+)
  Ejemplo: { name:"Filtro Aceite XYZ", code:"FILT-XYZ", cost:15000, price:25000, productGroupId:3 }

operation: "updateProduct" (kind:"write", requiresConfirmation:true)
  Actualiza campos específicos de un producto existente.
  Params: { productId:number, name?:string, code?:string, price?:number, cost?:number, description?:string, productGroupId?:number }
  Nivel de acceso requerido: ADMIN (nivel 1+)
  Ejemplo: { productId:456, price:32000, cost:18000 }
  IMPORTANTE: Solo envía los campos que deben cambiar. Los demás permanecen intactos.

operation: "deleteProduct" (kind:"write", requiresDoubleConfirmation:true)
  Desactiva (soft-delete) un producto. Permanece en historial/kardex pero desaparece de listados activos.
  Params: { productId:number }
  Nivel de acceso requerido: ADMIN (nivel 1+)

operation: "updateDocumentMetadata" (kind:"write", requiresConfirmation:true)
  Actualiza metadatos de un documento (nota, nombre de cliente, vínculos de cliente/proveedor).
  Params: { documentId:number, note?:string, clientName?:string, clientId?:number, customerId?:number }
  Nivel de acceso requerido: CASHIER (nivel 0+)
  Ejemplo: { documentId:300, note:"Entregado el 15 de marzo 2026" }

REGLAS PARA PROPONER ACCIONES:
1. Si el usuario pide VER datos específicos que el contexto actual no cubre completamente → propón queryDB
2. Si pide MODIFICAR precio/costo/nombre de un producto → propón updateProduct (solo los campos mencionados)
3. Si pide DESACTIVAR o ELIMINAR un producto → propón deleteProduct (siempre doble confirmación)
4. Si pide AJUSTAR o CORREGIR stock → propón adjustStock con la cantidad nueva exacta
5. Si pide CREAR un producto → propón createProduct (siempre doble confirmación)
6. Si pide EDITAR nota o cliente de un documento → propón updateDocumentMetadata
7. SIEMPRE explica en lenguaje claro QUÉ va a hacer la acción ANTES de permitir ejecutarla
8. Para escribir datos, usa requiresConfirmation:true. Para borrar/crear, requiresDoubleConfirmation:true
9. Nunca inventes IDs. Solo usa IDs que aparezcan en el contexto provisto o que el usuario mencione explícitamente
`;

  return [
    'Eres el asistente interno de TRACTO AGRICOLA dentro del sistema InventoryTW.',
    `Gestionas un inventario de ${totalProducts} productos en multiples bodegas.`,
    `Contexto actual: modulo=${currentModule}, ruta=${currentPath}.`,
    'Responde en espanol natural, claro y concreto; evita sonar mecanico o excesivamente estructurado.',
    'Usa tono conversacional profesional. Solo usa listas/tablas si realmente mejoran la comprension.',
    'Puedes usar el contexto de base de datos y resultados web provistos por el backend.',
    'Ayuda con inventario, productos, grupos, documentos, compras, ventas, kardex y operacion del sistema.',
    dbSchema,
    operationsDoc,
    'Si el usuario pregunta por lo que esta viendo en pantalla (ej: documento abierto), prioriza el contexto de pantalla provisto y explicalo de forma legible.',
    'Cuando el usuario pida editar/escribir datos, primero responde con un mini plan y preguntas de confirmacion (que, por que, alcance) antes de ejecutar.',
    'Si propones cambios, especifica exactamente que campos se tocaran y que campos NO se tocaran.',
    'Regla critica: si hay coincidencia exacta por codigo de producto o numero de documento, usa solo esa coincidencia como fuente principal.',
    'No mezcles datos de productos/documentos distintos en una misma respuesta.',
    'Para contar productos totales, usa la lista de candidatos encontrados o responde que puedo verificar en el backend.',
    'No inventes datos, stock, precios ni resultados de documentos.',
    'CRITICO: Tienes acceso al tool "queryDB" para consultar la base de datos real. DEBES invocarlo cuando el usuario pida ver, listar, buscar o consultar datos (productos, stock, kardex, documentos, etc.). NO inventes resultados ni muestres datos de ejemplo.',
    'CRITICO: Usa el parametro columns[] del tool para mostrar SOLO las columnas que el usuario solicito (ejemplo: si pide "id y nombre" usa columns:["idProduct","name"]). Si busca por texto parcial usa nameContains o codeContains.',
    'CRITICO: Despues de recibir los resultados del tool, presenta los datos de forma clara. NO muestres los parametros internos del tool al usuario.',
    'Prioriza respuestas utiles, cortas y accionables.',
    pageSnapshot ? `Contexto visible actual de pantalla: ${pageSnapshot}` : '',
    productsInline ? `Productos candidatos encontrados: ${productsInline}` : '',
    docsInline ? `Documentos candidatos encontrados: ${docsInline}` : '',
    warehousesInline ? `Bodegas candidatas encontradas: ${warehousesInline}` : '',
    kardexInline ? `Movimientos kardex candidatos: ${kardexInline}` : '',
    webInline ? `Resultados web sugeridos: ${webInline}` : '',
  ].join('\n');
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

      const asksAboutWarehouse = /(bodega|almacen|almacén|warehouse)/i.test(message);
      const asksAboutKardex = /(kardex|movimiento|historial|entrada|salida)/i.test(message);

      const [products, documents, warehouses, kardexEntries, webResults] = await Promise.all([
        fetchProductMatches(message),
        fetchDocumentMatches(message),
        asksAboutWarehouse ? fetchWarehouseMatches(message) : Promise.resolve([]),
        asksAboutKardex ? fetchKardexMatches(message) : Promise.resolve([]),
        searchWeb(message, Boolean(body?.enableWeb)),
      ]);

      const bedrockHistory: ChatMessage[] = [
        ...history,
        { role: 'user' as const, content: message.slice(0, 3000) },
      ].slice(-16);
      const { text, toolTables } = await invokeModelWithToolLoop(
        bedrockHistory,
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
      if (asksAboutWarehouse) {
        for (const w of warehouses) {
          links.push({ label: `Bodega ${w.name || w.id}`, url: `/stock?warehouseId=${w.id}` });
        }
      }
      if (asksAboutKardex) {
        for (const k of kardexEntries) {
          links.push({ label: `Kardex #${k.id} (${k.type || 'mov'})`, url: '/kardex' });
        }
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

      if (asksAboutWarehouse && warehouses.length === 0) {
        links.push({
          label: `Revisar bodegas para "${message.slice(0, 40)}"`,
          url: '/warehouses',
        });
      }

      if (asksAboutKardex && kardexEntries.length === 0) {
        links.push({
          label: `Revisar Kardex para "${message.slice(0, 40)}"`,
          url: '/kardex',
        });
      }

      // Tool tables primero — contienen datos reales de la BD
      const tables: AssistantTable[] = [...toolTables];
      // Solo agregar tablas de contexto si no hubo tool_use (evita duplicar)
      if (toolTables.length === 0) {
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
