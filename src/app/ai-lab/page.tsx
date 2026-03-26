'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Send, Loader2, User, RotateCcw, Sparkles, Paperclip, Globe, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  buildAssistantContext,
  executeAssistantAction,
  sendAssistantMessage,
  type AssistantAttachment,
  type AssistantMessage,
  type AssistantPayload,
} from '@/lib/ai/assistant-shared';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AssistantAttachment[];
  payload?: AssistantPayload;
};

const TEXT_FILE_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.tsv', '.log'];

function inferKind(file: File): AssistantAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  const lower = file.name.toLowerCase();
  if (TEXT_FILE_EXTENSIONS.some((e) => lower.endsWith(e))) return 'text';
  return 'document';
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
    fr.readAsDataURL(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const version = String(pdfjs?.version ?? '5.5.207');
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;

    const pages = Math.min(Number(pdf.numPages ?? 0), 8);
    const chunks: string[] = [];

    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const lines = (content?.items ?? [])
        .map((it: any) => String(it?.str ?? '').trim())
        .filter((s: string) => s.length > 0);
      if (lines.length) {
        chunks.push(`Pagina ${p}: ${lines.join(' ')}`);
      }
    }

    return chunks.join('\n').slice(0, 12000);
  } catch {
    return '';
  }
}

export default function AILabPage() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [enableWeb, setEnableWeb] = React.useState(true);
  const [attachments, setAttachments] = React.useState<AssistantAttachment[]>([]);
  const [doubleConfirmActionId, setDoubleConfirmActionId] = React.useState<string | null>(null);

  const pathname = usePathname();
  const safePathname = pathname ?? '/';

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message,
      attachments: attachments.length ? attachments : undefined,
    };
    const asstId = `a-${Date.now() + 1}`;

    setMessages((prev) => [...prev, userMsg, { id: asstId, role: 'assistant', content: '' }]);
    setInput('');
    setAttachments([]);
    setLoading(true);

    try {
      const history: AssistantMessage[] = messages
        .filter((m) => m.id !== asstId)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await sendAssistantMessage({
        message,
        history,
        attachments,
        enableWeb,
        context: buildAssistantContext(safePathname),
      });

      if (!result.ok) {
        const errText =
          result.status === 503
            ? '?? El asistente de IA no esta configurado aun. Contacta al administrador para activar las variables de entorno de Bedrock en Amplify Console.'
            : `? ${result.error ?? 'Error al procesar tu consulta'}`;
        setMessages((prev) =>
          prev.map((m) => (m.id === asstId ? { ...m, content: errText } : m))
        );
        return;
      }

      const data = result.data;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? {
                ...m,
                content: data.response ?? '(sin respuesta)',
                payload: {
                  links: data.links ?? [],
                  tables: data.tables ?? [],
                  actions: data.actions ?? [],
                  sources: data.sources ?? [],
                  contextEcho: data.contextEcho,
                },
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId && m.content === ''
            ? { ...m, content: '? No se pudo conectar con el asistente.' }
            : m
        )
      );
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    const picked = Array.from(files).slice(0, 4);
    const parsed: AssistantAttachment[] = [];

    for (const file of picked) {
      const kind = inferKind(file);
      const item: AssistantAttachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        kind,
      };

      if (kind === 'image') {
        if (file.size > 1_500_000) {
          item.text = 'Imagen omitida por tamano (maximo 1.5 MB).';
        } else {
          item.dataUrl = await fileToDataUrl(file);
        }
      } else if (kind === 'text') {
        const text = await file.text();
        item.text = text.slice(0, 12_000);
      } else {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (isPdf) {
          const extracted = await extractPdfText(file);
          item.text = extracted || `No se pudo extraer texto del PDF ${file.name}.`;
        } else {
          item.text = `Documento adjunto: ${file.name}. Tipo ${item.mimeType}.`;
        }
      }

      parsed.push(item);
    }

    setAttachments((prev) => [...prev, ...parsed].slice(0, 6));
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function submitProposedAction(action: NonNullable<AssistantPayload['actions']>[number]) {
    if (action.link?.url) {
      if (/^https?:\/\//i.test(String(action.link.url))) {
        window.open(action.link.url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = action.link.url;
      }
      return;
    }

    const needsDouble = Boolean(action.requiresDoubleConfirmation);
    if (needsDouble && doubleConfirmActionId !== action.id) {
      setDoubleConfirmActionId(action.id);
      return;
    }

    setDoubleConfirmActionId(null);

    if (action.execute?.operation) {
      setLoading(true);
      try {
        const result = await executeAssistantAction({
          operation: action.execute.operation,
          params: action.execute.params,
          confirmation: true,
          doubleConfirmation: Boolean(action.requiresDoubleConfirmation),
        });

        const id = `a-exec-${Date.now()}`;
        if (!result.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id,
              role: 'assistant',
              content: `? No se pudo ejecutar la accion: ${result.error}`,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id,
            role: 'assistant',
            content: `? ${result.data.message}`,
            payload: {
              links: [
                ...(Array.isArray(result.data.links) ? result.data.links : []),
                ...(result.data.link ? [result.data.link] : []),
              ],
              tables: result.data.table ? [result.data.table] : [],
              actions: [],
              sources: [],
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    void sendMessage(`Autorizo la accion propuesta: ${action.title}. Continua con un plan paso a paso y confirmacion final.`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const modelId = process.env.NEXT_PUBLIC_AI_MODEL_LABEL ?? 'Bedrock Conversational Model';
  const hasMessages = messages.length > 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-72px)] w-full max-w-6xl flex-col px-4 pb-4 pt-6 md:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Sparkles className="h-4 w-4 text-primary" />
          InventoryTW AI Workspace
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden md:inline-flex">
            AWS Bedrock · {modelId}
          </Badge>
          {hasMessages && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2"
              onClick={() => {
                setMessages([]);
                setDoubleConfirmActionId(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Nuevo chat
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border bg-background/95">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-primary/10 to-transparent" />

        <ScrollArea className="relative flex-1 px-4 py-6 md:px-8">
          {!hasMessages && (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center text-center">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                ¿Por donde empezamos?
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
                Preguntame sobre inventario, documentos, bodegas o kardex. Tambien puedes adjuntar imagenes y PDF para analizarlos dentro del flujo operativo.
              </p>
            </div>
          )}

          {hasMessages && (
            <div className="mx-auto w-full max-w-4xl space-y-5 pb-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'assistant' && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border bg-muted/40 text-foreground'
                    )}
                  >
                    {msg.role === 'assistant' && msg.content === '' && loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="space-y-3">
                        <div>{msg.content}</div>

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="space-y-2">
                            {msg.attachments.map((att) => (
                              <div key={att.id} className="rounded-md border border-white/30 px-2 py-1 text-xs">
                                {att.kind === 'image' ? '???' : '??'} {att.name}
                              </div>
                            ))}
                          </div>
                        )}

                        {msg.payload?.tables?.map((t, idx) => (
                          <div key={`table-${idx}`} className="overflow-auto rounded-xl border bg-background p-2 text-foreground">
                            <p className="mb-2 text-xs font-semibold">{t.title}</p>
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr>
                                  {t.columns.map((c) => (
                                    <th key={c} className="border-b py-1 pr-2 text-left font-medium">{c}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {t.rows.map((r, ri) => (
                                  <tr key={ri}>
                                    {r.map((cell, ci) => (
                                      <td key={`${ri}-${ci}`} className="border-b border-border/40 py-1 pr-2">{String(cell)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}

                        {msg.payload?.links && msg.payload.links.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {msg.payload.links.slice(0, 8).map((l, i) => {
                              const external = /^https?:\/\//i.test(String(l.url));
                              return external ? (
                                <a
                                  key={`lnk-${i}`}
                                  href={l.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-muted"
                                >
                                  {l.label} <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <Link key={`lnk-${i}`} href={l.url} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-muted">
                                  {l.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}

                        {msg.payload?.actions && msg.payload.actions.length > 0 && (
                          <div className="space-y-2 rounded-xl border bg-background p-2 text-foreground">
                            <p className="text-xs font-semibold">Acciones sugeridas (requieren aprobacion)</p>
                            {msg.payload.actions.map((a) => {
                              const waitingDouble = doubleConfirmActionId === a.id && a.requiresDoubleConfirmation;
                              return (
                                <div key={a.id} className="rounded border p-2">
                                  <p className="text-xs font-medium">{a.title}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                                  <div className="mt-2 flex gap-2">
                                    <Button
                                      size="sm"
                                      variant={waitingDouble ? 'destructive' : 'secondary'}
                                      className="h-7 text-xs"
                                      onClick={() => submitProposedAction(a)}
                                    >
                                      {waitingDouble ? 'Confirmar definitivamente' : 'Aprobar'}
                                    </Button>
                                    {a.requiresDoubleConfirmation && (
                                      <Badge variant="outline" className="text-[10px]">Doble confirmacion</Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {msg.payload?.contextEcho && (
                          <div className="rounded border border-dashed bg-background p-2 text-[11px] text-muted-foreground">
                            Contexto: modulo {msg.payload.contextEcho.currentModule} · ruta {msg.payload.contextEcho.currentPath} · productos {msg.payload.contextEcho.productsFound} · documentos {msg.payload.contextEcho.documentsFound}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {attachments.length > 0 && (
          <div className="mx-auto mb-2 w-full max-w-4xl px-4 md:px-8">
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.id} className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-2 py-1 text-xs">
                  <span>{a.kind === 'image' ? '???' : '??'} {a.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeAttachment(a.id)}
                    aria-label="Quitar adjunto"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-4xl px-4 pb-4 md:px-8">
          <div className="rounded-2xl border bg-card p-2 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.txt,.md,.csv,.json,.tsv,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                void handleFilesSelected(e.target.files);
                if (e.currentTarget) e.currentTarget.value = '';
              }}
            />

            <div className="flex gap-2">
              <Button
                variant={enableWeb ? 'default' : 'outline'}
                size="icon"
                onClick={() => setEnableWeb((v) => !v)}
                title="Activar/desactivar busqueda web"
                className="h-10 w-10 shrink-0 rounded-xl"
              >
                <Globe className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar imagen o documento"
                className="h-10 w-10 shrink-0 rounded-xl"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu consulta"
                disabled={loading}
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-xl border-0 bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50"
              />

              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-xl"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
