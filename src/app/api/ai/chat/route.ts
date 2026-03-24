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

function classifyGenerationError(message: string): { errorType: string; detail: string } {
  const m = message.toLowerCase();
  if (m.includes('mapping template')) {
    return {
      errorType: 'APPSYNC_MAPPING_TEMPLATE_ERROR',
      detail:
        'AppSync rechazo la ejecucion en el resolver de IA. Revisa permisos Bedrock del rol de AppSync y compatibilidad del modelo configurado.',
    };
  }
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

function extractNestedErrorInfo(err: any): { message: string; providerType?: string; providerDetail?: string } {
  const first = Array.isArray(err?.errors) && err.errors.length > 0 ? err.errors[0] : undefined;

  const messageCandidates = [
    err?.message,
    first?.message,
    first?.errorInfo?.message,
    first?.extensions?.message,
    first?.extensions?.errorInfo?.message,
    first?.originalError?.message,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  const providerTypeCandidates = [
    first?.errorType,
    first?.extensions?.errorType,
    first?.extensions?.code,
    err?.name,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  const providerDetailCandidates = [
    first?.errorInfo?.detail,
    first?.extensions?.errorInfo?.detail,
    first?.extensions?.exception?.message,
    first?.extensions?.cause?.message,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  return {
    message: messageCandidates[0] ?? 'Error desconocido',
    providerType: providerTypeCandidates[0],
    providerDetail: providerDetailCandidates[0],
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
    console.error('[AI Chat] Response structure not recognized:', { type: typeof raw, keys: responseKeys, raw });
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

    const { text, debugCode, errorType, detail } = extractGenerationText(result);
    if (!text.trim()) {
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
    const extracted = extractNestedErrorInfo(err);
    const msg = extracted.message;
    const isTimeout = msg.includes('ai_timeout');
    const classified = classifyGenerationError(msg);

    if (process.env.NODE_ENV !== 'production') {
      console.error('[AI Chat] Generation error:', { message: msg, isTimeout });
    }

    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'La IA tardó demasiado en responder. Intenta una pregunta más concreta.'
          : `Error en IA Amplify: ${msg}`,
        errorType: isTimeout ? 'TIMEOUT' : classified.errorType,
        detail: isTimeout ? 'El modelo no respondio dentro de 22 segundos.' : classified.detail,
        providerType: extracted.providerType,
        providerDetail: extracted.providerDetail,
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
