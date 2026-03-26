'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Send, Loader2, User, RotateCcw, Sparkles, Paperclip, Globe, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buildAssistantContext, sendAssistantMessage, type AssistantAttachment, type AssistantMessage, type AssistantPayload } from '@/lib/ai/assistant-shared';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AssistantAttachment[];
  payload?: AssistantPayload;
};

const SUGGESTED = [
  'Busca en la web tendencias de precio de repuestos agrícolas y compáralas con nuestro stock actual',
  'Muéstrame productos relacionados con filtro hidráulico y dame enlaces directos',
  'Quiero analizar documentos recientes y detectar posibles duplicados de productos',
  'Resume este módulo y sugiere los próximos pasos operativos',
  'Proponme cómo ajustar stock crítico, pero con confirmación antes de aplicar cambios',
];

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
            ? '⚠️ El asistente de IA no está configurado aún. Contacta al administrador para activar las variables de entorno de Bedrock en Amplify Console.'
            : `❌ ${result.error ?? 'Error al procesar tu consulta'}`;
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
            ? { ...m, content: '❌ No se pudo conectar con el asistente.' }
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
        // Keep image support practical for chat payloads.
        if (file.size > 1_500_000) {
          item.text = 'Imagen omitida por tamaño (máximo 1.5 MB).';
        } else {
          item.dataUrl = await fileToDataUrl(file);
        }
      } else if (kind === 'text') {
        const text = await file.text();
        item.text = text.slice(0, 12_000);
      } else {
        // Placeholder for binary docs until OCR/parser pipeline is added.
        item.text = `Documento adjunto: ${file.name}. Tipo ${item.mimeType}.`;
      }

      parsed.push(item);
    }

    setAttachments((prev) => [...prev, ...parsed].slice(0, 6));
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function submitProposedAction(action: NonNullable<AssistantPayload['actions']>[number]) {
    const needsDouble = Boolean(action.requiresDoubleConfirmation);
    if (needsDouble && doubleConfirmActionId !== action.id) {
      setDoubleConfirmActionId(action.id);
      return;
    }

    setDoubleConfirmActionId(null);
    void sendMessage(`Autorizo la acción propuesta: ${action.title}. Continúa con un plan paso a paso y confirmación final.`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const modelId = process.env.NEXT_PUBLIC_AI_MODEL_LABEL ?? 'Bedrock Conversational Model';

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            InventoryTW AI Workspace
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Chat unificado con contexto del módulo, adjuntos, enlaces navegables, tablas y decisiones asistidas
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          Powered by AWS Bedrock · {modelId}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ── Chat ── */}
        <Card className="lg:col-span-3 flex flex-col h-[600px]">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Chat con el asistente
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 overflow-hidden p-0">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground gap-3">
                  <Bot className="h-10 w-10 opacity-30" />
                  <div>
                    <p className="font-medium">Hola, soy tu asistente de inventario</p>
                    <p className="text-sm">Pregúntame sobre productos, stock, documentos o el sistema</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
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
                                  {att.kind === 'image' ? '🖼️' : '📄'} {att.name}
                                </div>
                              ))}
                            </div>
                          )}

                          {msg.payload?.tables?.map((t, idx) => (
                            <div key={`table-${idx}`} className="rounded-md border p-2 bg-background text-foreground overflow-auto">
                              <p className="text-xs font-semibold mb-2">{t.title}</p>
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr>
                                    {t.columns.map((c) => (
                                      <th key={c} className="border-b text-left py-1 pr-2 font-medium">{c}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {t.rows.map((r, ri) => (
                                    <tr key={ri}>
                                      {r.map((cell, ci) => (
                                        <td key={`${ri}-${ci}`} className="py-1 pr-2 border-b border-border/40">{String(cell)}</td>
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
                                    className="text-xs rounded-full border px-2 py-1 hover:bg-muted inline-flex items-center gap-1"
                                  >
                                    {l.label} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <Link key={`lnk-${i}`} href={l.url} className="text-xs rounded-full border px-2 py-1 hover:bg-muted inline-flex items-center gap-1">
                                    {l.label}
                                  </Link>
                                );
                              })}
                            </div>
                          )}

                          {msg.payload?.actions && msg.payload.actions.length > 0 && (
                            <div className="space-y-2 rounded-md border p-2 bg-background text-foreground">
                              <p className="text-xs font-semibold">Acciones sugeridas (requieren aprobación)</p>
                              {msg.payload.actions.map((a) => {
                                const waitingDouble = doubleConfirmActionId === a.id && a.requiresDoubleConfirmation;
                                return (
                                  <div key={a.id} className="rounded border p-2">
                                    <p className="text-xs font-medium">{a.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
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
                                        <Badge variant="outline" className="text-[10px]">Doble confirmación</Badge>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {msg.payload?.contextEcho && (
                            <div className="text-[11px] text-muted-foreground rounded border border-dashed p-2 bg-background">
                              Contexto: módulo {msg.payload.contextEcho.currentModule} · ruta {msg.payload.contextEcho.currentPath} · productos {msg.payload.contextEcho.productsFound} · documentos {msg.payload.contextEcho.documentsFound}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 flex gap-2 items-end">
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

              <Button
                variant={enableWeb ? 'default' : 'outline'}
                size="icon"
                onClick={() => setEnableWeb((v) => !v)}
                title="Activar/desactivar búsqueda web"
                className="shrink-0"
              >
                <Globe className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar imagen o documento"
                className="shrink-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu consulta… Puedes pedir web, análisis de módulo o proponer acciones con confirmación"
                disabled={loading}
                rows={2}
                className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {attachments.length > 0 && (
              <div className="px-3 pb-3 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <div key={a.id} className="text-xs rounded-full border px-2 py-1 inline-flex items-center gap-2 bg-muted/40">
                    <span>{a.kind === 'image' ? '🖼️' : '📄'} {a.name}</span>
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
            )}
          </CardContent>
        </Card>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Preguntas sugeridas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 p-3 pt-0">
              {SUGGESTED.map((q, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left h-auto whitespace-normal py-2 px-2 text-xs leading-snug"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                >
                  {q}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Capacidades activas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs p-3 pt-0">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Contexto módulo</span>
                <Badge variant="secondary" className="text-xs">ON</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Consulta BD</span>
                <Badge variant="secondary" className="text-xs">ON</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Búsqueda web</span>
                <Badge variant={enableWeb ? 'default' : 'outline'} className="text-xs">{enableWeb ? 'ON' : 'OFF'}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Acciones aprobables</span>
                <Badge variant="secondary" className="text-xs">ON</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notas</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground p-3 pt-0 space-y-2">
              <div className="flex gap-2 items-start">
                <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-600" />
                <p>Imágenes y archivos de texto se procesan dentro del chat.</p>
              </div>
              <div className="flex gap-2 items-start">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600" />
                <p>Documentos binarios (PDF/DOC) se registran, pero su OCR avanzado se agregará en la siguiente fase.</p>
              </div>
            </CardContent>
          </Card>

          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                setMessages([]);
                setDoubleConfirmActionId(null);
              }}
            >
              <RotateCcw className="h-3 w-3" />
              Limpiar chat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
