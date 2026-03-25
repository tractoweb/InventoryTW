import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  error?: { type?: string; message?: string };
};

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => m && typeof m.role === 'string' && typeof m.content === 'string')
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .slice(-16)
    .map((m: any) => ({
      role: m.role,
      content: String(m.content).slice(0, 3000),
    }));
}

function buildSystemPrompt(): string {
  return [
    'Eres el asistente interno de TRACTO AGRICOLA dentro del sistema InventoryTW.',
    'Responde en espanol claro y concreto.',
    'Ayuda con inventario, productos, grupos, documentos, compras, ventas, kardex y operacion del sistema.',
    'Si no sabes algo del estado real de la base de datos o no tienes acceso a una consulta exacta, dilo explicitamente.',
    'No inventes datos, stock, precios, ni resultados de documentos.',
    'Prioriza respuestas utiles, cortas y accionables.',
  ].join(' ');
}

async function generateResponse(messages: ChatMessage[]): Promise<string> {
  const accessKeyId = readEnv('BEDROCK_ACCESS_KEY_ID');
  const secretAccessKey = readEnv('BEDROCK_SECRET_ACCESS_KEY');
  const region = readEnv('AI_BEDROCK_REGION') ?? 'us-east-2';
  const modelId =
    readEnv('AI_MODEL_PRIMARY') ??
    readEnv('AI_MODEL') ??
    'anthropic.claude-3-5-sonnet-20240620-v1:0';
  const maxTokens = Number(readEnv('AI_MAX_TOKENS') ?? '1024');

  if (!accessKeyId || !secretAccessKey) {
    const envPresence = {
      BEDROCK_ACCESS_KEY_ID: Boolean(accessKeyId),
      BEDROCK_SECRET_ACCESS_KEY: Boolean(secretAccessKey),
      AI_BEDROCK_REGION: Boolean(readEnv('AI_BEDROCK_REGION')),
      AI_MODEL_PRIMARY: Boolean(readEnv('AI_MODEL_PRIMARY')),
      NODE_ENV: readEnv('NODE_ENV') ?? 'unknown',
    };
    throw new Error(`Credenciales Bedrock no configuradas (${JSON.stringify(envPresence)})`);
  }

  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: Number.isFinite(maxTokens) ? maxTokens : 1024,
    system: buildSystemPrompt(),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const result = await client.send(command);

  const decoded = new TextDecoder().decode(result.body);
  const payload = JSON.parse(decoded) as ClaudeResponse;

  if (payload.error) {
    throw new Error(`${payload.error.message ?? 'Error Bedrock'} [${payload.error.type ?? 'BEDROCK_ERROR'}]`);
  }

  const text = payload.content
    ?.filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Bedrock respondió vacío');
  }

  return text;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages = sanitizeMessages(rawMessages);

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No hay mensajes válidos en la solicitud',
          errorType: 'INVALID_INPUT',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userMessage = messages[messages.length - 1]?.content || '';
    if (!userMessage) {
      return new Response(
        JSON.stringify({
          error: 'El mensaje del usuario está vacío',
          errorType: 'EMPTY_MESSAGE',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await generateResponse(messages);

    // Stream response in chunks (simulating streaming)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let idx = 0;
        const chunkSize = 40;
        const interval = setInterval(() => {
          if (idx >= response.length) {
            clearInterval(interval);
            controller.close();
            return;
          }
          const chunk = response.slice(idx, idx + chunkSize);
          controller.enqueue(encoder.encode(chunk));
          idx += chunkSize;
        }, 40);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: `Error: ${error?.message || 'Desconocido'}`,
        errorType: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
