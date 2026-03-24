import { type NextRequest } from 'next/server';

import { amplifyClient } from '@/lib/amplify-config';
import { getCurrentSession } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 30;

type AiMode = 'query' | 'document' | 'image' | 'development';

const MODES: Record<AiMode, string> = {
  query: 'Consulta general de inventario y operaciones',
  document: 'Analisis y resumen de documentos cargados por el usuario',
  image: 'Analisis tecnico de imagen/fotografia usando metadatos y contexto',
  development: 'Asistencia de desarrollo de software y analisis tecnico',
};

function normalizeText(value: unknown, maxLen: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function modeInstruction(mode: AiMode): string {
  switch (mode) {
    case 'document':
      return 'Analiza el documento, entrega resumen ejecutivo, hallazgos clave, riesgos y recomendaciones accionables.';
    case 'image':
      return 'Analiza metadatos y contexto de la imagen. Describe posibles hallazgos tecnicos, limites del analisis y siguientes pasos de validacion.';
    case 'development':
      return 'Responde como arquitecto de software: propone mejoras concretas, riesgos, rendimiento, seguridad y pasos de implementacion.';
    default:
      return 'Responde de forma breve, precisa y accionable para el contexto operativo.';
  }
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
    console.error('[AI Workbench] Response structure not recognized:', { type: typeof raw, keys: responseKeys, raw });
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

  let body: { mode?: unknown; prompt?: unknown; context?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo invalido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const modeRaw = normalizeText(body.mode, 30).toLowerCase();
  const mode = (['query', 'document', 'image', 'development'].includes(modeRaw)
    ? modeRaw
    : 'query') as AiMode;

  const prompt = normalizeText(body.prompt, 12000);
  const context = normalizeText(body.context, 24000);

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Debes enviar un prompt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const generationFn = (amplifyClient as any)?.generations?.inventoryAssistant;
  if (typeof generationFn !== 'function') {
    return new Response(
      JSON.stringify({
        error:
          'La ruta IA de Amplify no esta disponible. Verifica despliegue de backend (inventoryAssistant).',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const userLabel =
    [session.data.firstName, session.data.lastName].filter(Boolean).join(' ').trim() ||
    session.data.email ||
    `Usuario #${session.data.userId}`;

  const composedInput = [
    `Modo: ${MODES[mode]}`,
    `Instruccion: ${modeInstruction(mode)}`,
    `Solicitud del usuario: ${prompt}`,
  ].join('\n');

  const composedContext = [
    `Usuario: ${userLabel}`,
    context ? `Contexto adicional: ${context}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const timeoutMs = 24000;
    const result = await Promise.race([
      generationFn({
        input: composedInput,
        context: composedContext,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ai_timeout')), timeoutMs)),
    ]);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[AI Workbench] Mode:', mode, 'Response type:', typeof result, 'Keys:', typeof result === 'object' ? Object.keys(result || {}) : 'N/A');
    }

    const { text, debugCode } = extractGenerationText(result);
    const trimmedText = text.trim();
    if (!trimmedText) {
      const errorPayload: any = { error: 'La IA no devolvio contenido.' };
      if (process.env.NODE_ENV !== 'production' && debugCode) {
        errorPayload.debugCode = debugCode;
      }
      return new Response(JSON.stringify(errorPayload), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: trimmedText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const msg = String(err?.message ?? 'Error desconocido');
    const isTimeout = msg.includes('ai_timeout');

    if (process.env.NODE_ENV !== 'production') {
      console.error('[AI Workbench] Generation error:', { message: msg, isTimeout, mode });
    }

    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'La IA tardo demasiado en responder. Intenta con un contexto mas corto.'
          : `Error en IA Amplify: ${msg}`,
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
