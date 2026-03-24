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

function extractGenerationText(raw: any): string {
  if (typeof raw === 'string') return raw;
  if (typeof raw?.data === 'string') return raw.data;
  if (typeof raw?.text === 'string') return raw.text;
  if (typeof raw?.output === 'string') return raw.output;
  if (typeof raw?.data?.text === 'string') return raw.data.text;
  if (Array.isArray(raw?.data) && raw.data.length > 0) {
    const first = raw.data[0];
    if (typeof first === 'string') return first;
    if (typeof first?.text === 'string') return first.text;
  }
  return '';
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

    const timeoutMs = 22000;
    const result = await Promise.race([
      generationFn({
        input: last.content,
        context: buildContext(messages, userLabel),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ai_timeout')), timeoutMs)),
    ]);

    const text = extractGenerationText(result);
    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: 'La IA no devolvió contenido. Intenta reformular la pregunta.' }),
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
