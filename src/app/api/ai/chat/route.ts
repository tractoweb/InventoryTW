import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
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
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
}

async function generateResponse(messages: ChatMessage[]): Promise<string> {
  const apiKey = readEnv('GEMINI_API_KEY');
  const model = readEnv('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const temperature = Number(readEnv('GEMINI_TEMPERATURE') ?? '0.3');
  const maxOutputTokens = Number(readEnv('GEMINI_MAX_TOKENS') ?? '1024');

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemInstruction() }],
      },
      contents: toGeminiContents(messages),
      generationConfig: {
        temperature: Number.isFinite(temperature) ? temperature : 0.3,
        maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1024,
      },
    }),
    cache: 'no-store',
  });

  const payload = (await response.json()) as GeminiApiResponse;

  if (!response.ok) {
    const message = payload?.error?.message || 'Error llamando a Gemini';
    const status = payload?.error?.status || 'GEMINI_API_ERROR';
    throw new Error(`${message} [${status}]`);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => String(part?.text ?? ''))
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini respondió vacío');
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
