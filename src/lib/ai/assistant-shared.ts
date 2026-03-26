export type AssistantAttachment = {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'text' | 'document';
  dataUrl?: string;
  text?: string;
};

export type AssistantPayload = {
  links?: Array<{ label: string; url: string }>;
  tables?: Array<{ title: string; columns: string[]; rows: Array<Array<string | number>> }>;
  actions?: Array<{ id: string; title: string; description: string; requiresConfirmation: boolean; requiresDoubleConfirmation?: boolean }>;
  sources?: Array<{ title: string; url: string; snippet: string }>;
  contextEcho?: { currentModule: string; currentPath: string; productsFound: number; documentsFound: number };
};

export type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantResponse = {
  response: string;
  model?: string;
  timestamp?: string;
  links?: AssistantPayload['links'];
  tables?: AssistantPayload['tables'];
  actions?: AssistantPayload['actions'];
  sources?: AssistantPayload['sources'];
  contextEcho?: AssistantPayload['contextEcho'];
};

export function deriveModuleFromPath(pathname: string | null | undefined): string {
  const safe = String(pathname ?? '/').trim();
  if (!safe || safe === '/') return 'dashboard';
  return safe.split('/').filter(Boolean)[0] || 'dashboard';
}

export function buildAssistantContext(pathname: string | null | undefined, extra?: Record<string, unknown>) {
  const currentPath = String(pathname ?? '/');
  const currentModule = deriveModuleFromPath(currentPath);
  return {
    system: 'InventoryTW',
    totalProducts: '1.243+',
    currentPath,
    currentModule,
    ...(extra ?? {}),
  } as Record<string, unknown>;
}

export async function sendAssistantMessage(input: {
  message: string;
  history?: AssistantMessage[];
  attachments?: AssistantAttachment[];
  enableWeb?: boolean;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{ ok: true; data: AssistantResponse } | { ok: false; error: string; status: number }> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: input.signal,
    body: JSON.stringify({
      message: input.message,
      history: (input.history ?? []).slice(-16),
      attachments: input.attachments ?? [],
      enableWeb: Boolean(input.enableWeb),
      context: input.context ?? {},
    }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const err = typeof payload?.error === 'string' ? payload.error : 'Error del servidor';
    return { ok: false, error: err, status: response.status };
  }

  return {
    ok: true,
    data: {
      response: typeof payload?.response === 'string' ? payload.response : '',
      model: typeof payload?.model === 'string' ? payload.model : undefined,
      timestamp: typeof payload?.timestamp === 'string' ? payload.timestamp : undefined,
      links: Array.isArray(payload?.links) ? payload.links : [],
      tables: Array.isArray(payload?.tables) ? payload.tables : [],
      actions: Array.isArray(payload?.actions) ? payload.actions : [],
      sources: Array.isArray(payload?.sources) ? payload.sources : [],
      contextEcho: payload?.contextEcho ?? undefined,
    },
  };
}
