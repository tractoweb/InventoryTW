import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type OpenAIChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    code?: number | string;
    message?: string;
    status?: string;
    type?: string;
  };
};

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readSecretsBlob(): Record<string, unknown> | null {
  const raw = process.env.secrets;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readEnvWithSecretsFallback(name: string): string | undefined {
  const direct = readEnv(name);
  if (direct) return direct;

  const secrets = readSecretsBlob();
  const fromSecrets = secrets?.[name];
  if (typeof fromSecrets === 'string' && fromSecrets.trim().length > 0) return fromSecrets.trim();

  return undefined;
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

function buildSystemInstruction(): string {
  return [
    'Eres el asistente interno de TRACTO AGRICOLA dentro del sistema InventoryTW.',
    'Responde en espanol claro y concreto.',
    'Ayuda con inventario, productos, grupos, documentos, compras, ventas, kardex y operacion del sistema.',
    'Si no sabes algo del estado real de la base de datos o no tienes acceso a una consulta exacta, dilo explicitamente.',
    'No inventes datos, stock, precios, ni resultados de documentos.',
    'Prioriza respuestas utiles, cortas y accionables.',
  ].join(' ');
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

async function generateResponse(messages: ChatMessage[]): Promise<string> {
  const apiKey = readEnvWithSecretsFallback('OPENAI_API_KEY');
  const baseUrl =
    readEnvWithSecretsFallback('OPENAI_BASE_URL') ??
    'https://bedrock-mantle.us-east-2.api.aws/v1';
  const model =
    readEnvWithSecretsFallback('OPENAI_MODEL') ??
    readEnvWithSecretsFallback('AI_MODEL_PRIMARY') ??
    readEnvWithSecretsFallback('AI_MODEL') ??
    'openai.gpt-oss-120b';
  const temperature = Number(readEnvWithSecretsFallback('OPENAI_TEMPERATURE') ?? '0.3');
  const maxOutputTokens = Number(readEnvWithSecretsFallback('OPENAI_MAX_TOKENS') ?? '1024');

  if (!apiKey) {
    const secrets = readSecretsBlob();
    const hasSecretsBlob = Boolean(process.env.secrets);
    const envPresence = {
      OPENAI_API_KEY: Boolean(readEnv('OPENAI_API_KEY')),
      OPENAI_BASE_URL: Boolean(readEnv('OPENAI_BASE_URL')),
      OPENAI_MODEL: Boolean(readEnv('OPENAI_MODEL')),
      AI_MODEL_PRIMARY: Boolean(readEnv('AI_MODEL_PRIMARY')),
      AI_MODEL: Boolean(readEnv('AI_MODEL')),
      secretsBlob: hasSecretsBlob,
      secretsOPENAI_API_KEY: Boolean(secrets && typeof secrets.OPENAI_API_KEY === 'string' && String(secrets.OPENAI_API_KEY).trim().length > 0),
      secretsOPENAI_BASE_URL: Boolean(secrets && typeof secrets.OPENAI_BASE_URL === 'string' && String(secrets.OPENAI_BASE_URL).trim().length > 0),
      AWS_BRANCH: Boolean(readEnv('AWS_BRANCH')),
      NODE_ENV: readEnv('NODE_ENV') ?? 'unknown',
    };
    throw new Error(`OPENAI_API_KEY no está configurada (${JSON.stringify(envPresence)})`);
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const url = `${normalizedBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemInstruction() },
        ...toGeminiContents(messages),
      ],
      temperature: Number.isFinite(temperature) ? temperature : 0.3,
      max_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1024,
      stream: false,
      // Keep compatibility if provider also accepts Responses API fields.
      max_output_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1024,
      generationConfig: {
        temperature: Number.isFinite(temperature) ? temperature : 0.3,
        maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1024,
      },
    }),
    cache: 'no-store',
  });

  const payload = (await response.json()) as OpenAIChatCompletionsResponse;

  if (!response.ok) {
    const message = payload?.error?.message || 'Error llamando a OpenAI-compatible API';
    const status =
      payload?.error?.status ||
      payload?.error?.type ||
      String(payload?.error?.code || 'OPENAI_COMPAT_API_ERROR');
    throw new Error(`${message} [${status}]`);
  }

  const text = String(payload?.choices?.[0]?.message?.content ?? '').trim();

  if (!text) {
    throw new Error('OpenAI-compatible API respondió vacío');
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
