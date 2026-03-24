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

function classifyGenerationError(message: string): { errorType: string; detail: string } {
  const m = message.toLowerCase();
  if (m.includes('accessdenied') || m.includes('not authorized') || m.includes('unauthorized')) {
    return {
      errorType: 'BEDROCK_ACCESS_DENIED',
      detail: 'El rol del backend no tiene permisos para invocar el modelo en Bedrock.',
    };
  }
  if (m.includes('throttl') || m.includes('rate exceeded') || m.includes('too many requests')) {
    return {
      errorType: 'BEDROCK_THROTTLED',
      detail: 'Bedrock esta limitando solicitudes por capacidad o cuota.',
    };
  }
  if (m.includes('model') && (m.includes('not found') || m.includes('not available') || m.includes('invalid model'))) {
    return {
      errorType: 'MODEL_NOT_AVAILABLE',
      detail: 'El modelo configurado no esta disponible para esta cuenta o region.',
    };
  }
  return {
    errorType: 'AMPLIFY_GENERATION_ERROR',
    detail: message,
  };
}

function extractGenerationText(raw: any): { text: string; debugCode?: string; errorType?: string; detail?: string } {
  // Direct string response
  if (typeof raw === 'string') return { text: raw };

  // GraphQL/Amplify errors array
  if (Array.isArray(raw?.errors) && raw.errors.length > 0) {
    const first = raw.errors[0];
    const message = String(first?.message ?? first ?? 'Error desconocido en generacion IA');
    const classified = classifyGenerationError(message);
    return { text: '', debugCode: 'graphql_errors_array', ...classified };
  }
  
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
    const entries = Object.entries(raw.data as Record<string, any>);
    for (const [routeName, val] of entries) {
      if (typeof val === 'string' && val.trim()) {
        return { text: val, debugCode: `amplify_native_route:${routeName}` };
      }
      if (val && typeof val === 'object') {
        if (typeof (val as any).text === 'string' && (val as any).text.trim()) {
          return { text: (val as any).text, debugCode: `amplify_route_object_text:${routeName}` };
        }
        if (Array.isArray((val as any).content)) {
          const textParts = (val as any).content
            .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
            .filter((t: string) => t.trim());
          if (textParts.length > 0) {
            return { text: textParts.join('\n'), debugCode: `amplify_route_object_content:${routeName}` };
          }
        }
      }
    }
  }

  // raw.content array (some model adapters)
  if (Array.isArray(raw?.content)) {
    const textParts = raw.content
      .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
      .filter((t: string) => t.trim());
    if (textParts.length > 0) {
      return { text: textParts.join('\n'), debugCode: 'content_array_text' };
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
  
  return { text: '', debugCode: 'response_format_unknown', errorType: 'UNKNOWN_RESPONSE_FORMAT', detail: 'La respuesta IA llego sin texto utilizable.' };
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

    const { text, debugCode, errorType, detail } = extractGenerationText(result);
    const trimmedText = text.trim();
    if (!trimmedText) {
      const errorPayload: any = {
        error: 'La IA no devolvio contenido utilizable.',
        errorType: errorType ?? 'EMPTY_RESPONSE',
      };
      if (detail) {
        errorPayload.detail = detail;
      }
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
    const classified = classifyGenerationError(msg);

    if (process.env.NODE_ENV !== 'production') {
      console.error('[AI Workbench] Generation error:', { message: msg, isTimeout, mode });
    }

    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'La IA tardo demasiado en responder. Intenta con un contexto mas corto.'
          : `Error en IA Amplify: ${msg}`,
        errorType: isTimeout ? 'TIMEOUT' : classified.errorType,
        detail: isTimeout ? 'El modelo no respondio dentro de 24 segundos.' : classified.detail,
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
