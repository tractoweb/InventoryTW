import { type NextRequest } from 'next/server';

import { amplifyClient } from '@/lib/amplify-config';
import { getCurrentSession } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 30;

function sanitizeMessages(raw: unknown): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => m && typeof m.role === 'string' && typeof m.content === 'string')
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .slice(-20)
    .map((m: any) => ({
      role: m.role,
      content: String(m.content).slice(0, 3000),
    }));
}

function buildContext(messages: Array<{ role: 'user' | 'assistant'; content: string }>, userLabel: string): string {
  const recent = messages.slice(-8);
  const lines = recent.map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`);
  return [`Usuario actual: ${userLabel}`, ...lines].join('\n');
}

function extractGenerationText(raw: any): { text: string; debugCode?: string } {
  // Direct string response
  if (typeof raw === 'string') return { text: raw };
  
  // raw.data as string
  if (typeof raw?.data === 'string') return { text: raw.data };
  
  // raw.text (common in AI SDK responses)
  if (typeof raw?.text === 'string') return { text: raw.text };
  
  // raw.output
  if (typeof raw?.output === 'string') return { text: raw.output };
  
  // raw.data.text (nested structure)
  if (typeof raw?.data?.text === 'string') return { text: raw.data.text };
  
  // Amplify native generation response: { data: { inventoryAssistant: "text" } }
  // or any other route name in data object
  if (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
    const values = Object.values(raw.data as Record<string, any>);
    for (const val of values) {
      if (typeof val === 'string' && val.trim()) {
        return { text: val, debugCode: 'amplify_native_route' };
      }
    }
  }
  
  // raw.data as array
  if (Array.isArray(raw?.data) && raw.data.length > 0) {
    const first = raw.data[0];
    if (typeof first === 'string') return { text: first };
    if (typeof first?.text === 'string') return { text: first.text };
  }
  
  // Log response structure for debugging (non-production-friendly)
  if (process.env.NODE_ENV !== 'production') {
    const responseKeys = typeof raw === 'object' ? Object.keys(raw || {}).join(',') : typeof raw;
    console.error('[AI Chat] Response structure not recognized:', { type: typeof raw, keys: responseKeys, raw });
  }
  
  return { text: '', debugCode: 'response_format_unknown' };
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session.data) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
  const last = messages.at(-1);
  if (!last || last.role !== 'user') {
    return new Response(JSON.stringify({ error: 'Mensaje inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userLabel =
    [session.data.firstName, session.data.lastName].filter(Boolean).join(' ').trim() ||
    session.data.email ||
    `Usuario #${session.data.userId}`;

  try {
    const generationFn = (amplifyClient as any)?.generations?.inventoryAssistant;
    if (typeof generationFn !== 'function') {
      return new Response(
        JSON.stringify({
          error:
            'La ruta IA de Amplify no está disponible todavía. Despliega el backend de Amplify con la nueva ruta `inventoryAssistant` y vuelve a intentar.',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[AI Chat] Calling inventoryAssistant generation with input length:', last.content.length);
    }

    const timeoutMs = 22000;
    const result = await Promise.race([
      generationFn({
        input: last.content,
        context: buildContext(messages, userLabel),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ai_timeout')), timeoutMs)),
    ]);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[AI Chat] Generation response type:', typeof result, 'keys:', typeof result === 'object' ? Object.keys(result || {}) : 'N/A');
    }

    const { text, debugCode } = extractGenerationText(result);
    if (!text.trim()) {
      const errorPayload: any = { error: 'La IA no devolvió contenido. Intenta reformular la pregunta.' };
      if (process.env.NODE_ENV !== 'production' && debugCode) {
        errorPayload.debugCode = debugCode;
      }
      return new Response(
        JSON.stringify(errorPayload),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Keep text/plain so current client streaming reader continues working.
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: any) {
    const msg = String(err?.message ?? 'Error desconocido');
    const isTimeout = msg.includes('ai_timeout');

    if (process.env.NODE_ENV !== 'production') {
      console.error('[AI Chat] Generation error:', { message: msg, isTimeout });
    }

    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'La IA tardó demasiado en responder. Intenta una pregunta más concreta.'
          : `Error en IA Amplify: ${msg}`,
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
