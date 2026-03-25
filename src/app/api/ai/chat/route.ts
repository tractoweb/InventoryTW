import { type NextRequest } from 'next/server';

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

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: 'duckduckgo' | 'wikipedia';
};

function normalizeQuestion(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

async function fetchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=0`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) return [];
  const data = (await response.json()) as any;
  const out: SearchResult[] = [];

  const abstractText = typeof data?.AbstractText === 'string' ? data.AbstractText.trim() : '';
  const abstractUrl = typeof data?.AbstractURL === 'string' ? data.AbstractURL.trim() : '';
  const heading = typeof data?.Heading === 'string' ? data.Heading.trim() : '';
  if (abstractText && abstractUrl) {
    out.push({
      title: heading || 'Resultado destacado',
      url: abstractUrl,
      snippet: abstractText,
      source: 'duckduckgo',
    });
  }

  const related = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
  for (const item of related.slice(0, 12)) {
    const topics = Array.isArray(item?.Topics) ? item.Topics : [item];
    for (const topic of topics) {
      if (out.length >= 6) break;
      const text = typeof topic?.Text === 'string' ? topic.Text.trim() : '';
      const firstUrl = typeof topic?.FirstURL === 'string' ? topic.FirstURL.trim() : '';
      if (!text || !firstUrl) continue;

      const title = text.split(' - ')[0]?.trim() || 'Referencia web';
      out.push({
        title,
        url: firstUrl,
        snippet: text,
        source: 'duckduckgo',
      });
    }
    if (out.length >= 6) break;
  }

  return out;
}

async function fetchWikipedia(query: string): Promise<SearchResult[]> {
  const url = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&srlimit=5&utf8=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) return [];
  const data = (await response.json()) as any;
  const results = Array.isArray(data?.query?.search) ? data.query.search : [];
  return results.slice(0, 5).map((entry: any) => {
    const title = String(entry?.title ?? '').trim() || 'Articulo';
    const rawSnippet = String(entry?.snippet ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      title,
      url: `https://es.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`,
      snippet: rawSnippet,
      source: 'wikipedia' as const,
    };
  });
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const result of results) {
    const key = result.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result);
  }
  return out;
}

function fallbackLinks(question: string): string {
  const encoded = encodeURIComponent(question);
  return [
    `- [Busqueda general de repuestos en la web](https://duckduckgo.com/?q=${encoded})`,
    `- [Busqueda tecnica: "catalogo de partes" + consulta](https://duckduckgo.com/?q=${encodeURIComponent(
      `${question} catalogo de partes`
    )})`,
    `- [Busqueda por OEM o numero de parte](https://duckduckgo.com/?q=${encodeURIComponent(
      `${question} OEM part number`
    )})`,
  ].join('\n');
}

function buildReply(question: string, results: SearchResult[], userLabel: string): string {
  const intro = [
    `## Asistente Web de Repuestos`,
    `Consulta: **${question}**`,
    '',
    `Hola ${userLabel}, encontre referencias web iniciales (sin usar AppSync ni base de datos):`,
  ];

  if (results.length === 0) {
    return [
      ...intro,
      '',
      'No obtuve resultados directos en este intento.',
      '',
      'Prueba estas busquedas recomendadas:',
      fallbackLinks(question),
      '',
      'Si quieres, en el siguiente mensaje te ayudo a afinar por marca, modelo, ano y numero de parte.',
    ].join('\n');
  }

  const lines = results.slice(0, 6).map((r, idx) => {
    const sourceLabel = r.source === 'wikipedia' ? 'Wikipedia' : 'DuckDuckGo';
    return `${idx + 1}. [${r.title}](${r.url})\n   Fuente: ${sourceLabel}\n   Resumen: ${r.snippet || 'Sin resumen disponible.'}`;
  });

  return [
    ...intro,
    '',
    ...lines,
    '',
    'Siguiente paso sugerido: comparte marca/modelo del equipo y, si existe, numero OEM para buscar resultados mas precisos.',
    '',
    'Nota: esta fase es solo consulta web. La conexion a AppSync y la BD la dejamos para la siguiente etapa.',
  ].join('\n');
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

  const question = normalizeQuestion(last.content);
  if (!question) {
    return new Response(JSON.stringify({ error: 'Mensaje vacio' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const searchQuery = `${question} repuestos maquinaria agricola`;
    const timeoutMs = 15000;
    const [duck, wiki] = await Promise.race([
      Promise.all([fetchDuckDuckGo(searchQuery), fetchWikipedia(searchQuery)]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('search_timeout')), timeoutMs)),
    ]);

    const merged = dedupeResults([...duck, ...wiki]);
    const text = buildReply(question, merged, userLabel);

    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: any) {
    const msg = String(err?.message ?? 'search_error');
    const isTimeout = msg.includes('search_timeout');
    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'La consulta web tardo demasiado. Intenta una pregunta mas corta.'
          : 'No fue posible consultar fuentes web en este momento.',
        errorType: isTimeout ? 'WEB_SEARCH_TIMEOUT' : 'WEB_SEARCH_ERROR',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
