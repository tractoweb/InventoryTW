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

export const runtime = 'nodejs';
export const maxDuration = 30;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
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

function buildSystemPrompt(context?: Record<string, unknown>): string {
  const totalProducts = typeof context?.totalProducts === 'string' ? context.totalProducts : '1.243+';
  return [
    'Eres el asistente interno de TRACTO AGRICOLA dentro del sistema InventoryTW.',
    `Gestionas un inventario de ${totalProducts} productos.`,
    'Responde en espanol claro y concreto.',
    'Ayuda con inventario, productos, grupos, documentos, compras, ventas, kardex y operacion del sistema.',
    'Si no tienes acceso a una consulta exacta de la base de datos, dilo explicitamente.',
    'No inventes datos, stock, precios ni resultados de documentos.',
    'Prioriza respuestas utiles, cortas y accionables.',
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

async function invokeModel(messages: ChatMessage[], context?: Record<string, unknown>): Promise<string> {
  const client = buildBedrockClient();
  const modelId =
    readEnv('AI_MODEL_PRIMARY') ??
    readEnv('AI_MODEL') ??
    'anthropic.claude-3-haiku-20240307-v1:0';
  const maxTokens = Number(readEnv('AI_MAX_TOKENS') ?? '1024');

  const command = new ConverseCommand({
    modelId,
    system: [{ text: buildSystemPrompt(context) }],
    messages: messages.map((message) => ({
      role: message.role,
      content: [{ text: message.content }],
    })),
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

      const messages: ChatMessage[] = [{ role: 'user', content: message.slice(0, 3000) }];
      const text = await invokeModel(messages, body.context);
      const modelId = readEnv('AI_MODEL_PRIMARY') ?? readEnv('AI_MODEL') ?? 'anthropic.claude-3-haiku-20240307-v1:0';

      return new Response(
        JSON.stringify({ response: text, model: modelId, timestamp: new Date().toISOString() }),
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

    const text = await invokeModel(messages);

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
