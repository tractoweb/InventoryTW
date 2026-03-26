"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Loader2, RotateCcw, Sparkles, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { buildAssistantContext, sendAssistantMessage, type AssistantMessage, type AssistantPayload } from "@/lib/ai/assistant-shared";
import { useChatAI } from "./chat-ai-provider";

// ─── Types ─────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  payload?: AssistantPayload;
};

// ─── Unified chat hook (shared with AI workspace backend contract) ────────

const STORAGE_KEY = "tracto-ai-chat-history";
const MAX_STORED = 50;

function useAssistantChat(pathname: string | null) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [enableWeb, setEnableWeb] = React.useState(true);
  const abortRef = React.useRef<AbortController | null>(null);
  const hydrated = React.useRef(false);

  // Load history from localStorage on mount
  React.useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_STORED));
      }
    } catch {}
  }, []);

  // Save to localStorage when messages change
  React.useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {}
  }, [messages]);

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: trimmed };
      const asstId = `a-${Date.now() + 1}`;

      setMessages((prev) => [...prev, userMsg, { id: asstId, role: "assistant", content: "" }]);
      setInput("");
      setIsLoading(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const timeout = setTimeout(() => ctrl.abort(), 25000);

      const history: AssistantMessage[] = messages
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const result = await sendAssistantMessage({
          message: trimmed,
          history,
          enableWeb,
          context: buildAssistantContext(pathname),
          signal: ctrl.signal,
        });

        if (!result.ok) {
          const errMsg = result.status === 503
            ? "El asistente no está configurado en el servidor."
            : (result.error || "Error del servidor.");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId ? { ...m, content: `❌ ${errMsg}` } : m
            )
          );
          return;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? {
                  ...m,
                  content: result.data.response || "(sin respuesta)",
                  payload: {
                    links: result.data.links ?? [],
                    tables: result.data.tables ?? [],
                    actions: result.data.actions ?? [],
                    sources: result.data.sources ?? [],
                    contextEcho: result.data.contextEcho,
                  },
                }
              : m
          )
        );
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId && m.content === ""
                ? { ...m, content: "❌ La respuesta tardó demasiado. Intenta una consulta más puntual." }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId && m.content === ""
                ? { ...m, content: "❌ No se pudo conectar con el asistente. Verifica tu conexión." }
                : m
            )
          );
        }
      } finally {
        clearTimeout(timeout);
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading, enableWeb, pathname]
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clear = React.useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { messages, input, setInput, isLoading, enableWeb, setEnableWeb, sendMessage, stop, clear };
}

// ─── Inline Markdown renderer ──────────────────────────────────────────────

function parseInline(text: string, keyPfx: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  // Combined: links [text](url) and bold **text**
  const re = /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)|\*\*([^*\n]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(<React.Fragment key={`${keyPfx}-t${last}`}>{text.slice(last, m.index)}</React.Fragment>);
    }
    if (m[1] && m[2]) {
      const isExt = m[2].startsWith("http");
      nodes.push(
        isExt ? (
          <a
            key={`${keyPfx}-l${m.index}`}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 font-medium"
          >
            {m[1]}
          </a>
        ) : (
          <Link
            key={`${keyPfx}-l${m.index}`}
            href={m[2]}
            className="text-primary underline hover:text-primary/80 font-medium"
          >
            {m[1]}
          </Link>
        )
      );
    } else if (m[3]) {
      nodes.push(<strong key={`${keyPfx}-b${m.index}`} className="font-semibold">{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    nodes.push(<React.Fragment key={`${keyPfx}-t${last}`}>{text.slice(last)}</React.Fragment>);
  }

  return nodes.length ? <>{nodes}</> : <>{text}</>;
}

function MarkdownMessage({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-1.5 text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Headings
        if (trimmed.startsWith("### "))
          return <p key={bi} className="font-semibold">{parseInline(trimmed.slice(4), `${bi}`)}</p>;
        if (trimmed.startsWith("## "))
          return <p key={bi} className="font-bold text-base">{parseInline(trimmed.slice(3), `${bi}`)}</p>;

        // Lists (every line starts with - * or number)
        const lines = trimmed.split("\n");
        const allList = lines.every((l) => /^[-*•]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim()));

        if (allList) {
          return (
            <ul key={bi} className="space-y-0.5 ml-1">
              {lines.map((line, li) => {
                const t = line.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "").trim();
                return (
                  <li key={li} className="flex items-start gap-1.5">
                    <span className="mt-[7px] h-1 w-1 rounded-full bg-current shrink-0 opacity-60" />
                    <span>{parseInline(t, `${bi}-${li}`)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Regular paragraph (preserve single line breaks)
        return (
          <p key={bi}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {parseInline(line, `${bi}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function PayloadExtras({ payload }: { payload?: AssistantPayload }) {
  if (!payload) return null;

  return (
    <div className="mt-2 space-y-2">
      {(payload.tables ?? []).map((t, idx) => (
        <div key={`t-${idx}`} className="rounded-md border p-2 bg-background overflow-auto">
          <p className="text-[11px] font-semibold mb-1">{t.title}</p>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr>
                {t.columns.map((c) => (
                  <th key={c} className="text-left border-b py-1 pr-2">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={`${ri}-${ci}`} className="py-1 pr-2 border-b border-border/40">{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {(payload.links ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(payload.links ?? []).slice(0, 6).map((l, i) => {
            const ext = /^https?:\/\//i.test(String(l.url));
            return ext ? (
              <a
                key={`ln-${i}`}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] rounded-full border px-2 py-0.5 inline-flex items-center gap-1 hover:bg-muted"
              >
                {l.label} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : (
              <Link key={`ln-${i}`} href={l.url} className="text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted">
                {l.label}
              </Link>
            );
          })}
        </div>
      )}

      {(payload.actions ?? []).length > 0 && (
        <div className="rounded-md border p-2 bg-background">
          <p className="text-[11px] font-semibold mb-1">Acciones propuestas</p>
          <ul className="space-y-1 text-[11px] text-muted-foreground">
            {(payload.actions ?? []).map((a) => (
              <li key={a.id}>• {a.title}{a.requiresDoubleConfirmation ? " (doble confirmación)" : ""}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isEmpty = msg.role === "assistant" && msg.content === "";

  return (
    <div className={cn("flex gap-2 mb-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm break-words [overflow-wrap:anywhere]",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground"
        )}
      >
        {isEmpty ? (
          // Typing indicator
          <span className="flex items-center gap-1 py-0.5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        ) : isUser ? (
          <span className="whitespace-pre-wrap break-words">{msg.content}</span>
        ) : (
          <>
            <MarkdownMessage content={msg.content} />
            <PayloadExtras payload={msg.payload} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Quick chip suggestions ────────────────────────────────────────────────

const QUICK_CHIPS = [
  "Buscar repuesto bomba hidraulica John Deere 5075E",
  "Diferencia entre filtro de combustible primario y secundario",
  "Que revisar si el tractor pierde fuerza en subida",
  "Catalogo de partes para sistema de frenos tractor agricola",
  "Como identificar numero OEM de un rodamiento",
];

// ─── Main panel component ──────────────────────────────────────────────────

export function ChatAIPanel() {
  const { isOpen, close } = useChatAI();
  const pathname = usePathname();
  const { messages, input, setInput, isLoading, enableWeb, setEnableWeb, sendMessage, stop, clear } = useAssistantChat(pathname);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading && input.trim()) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Overlay on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        role="complementary"
        aria-label="Asistente IA"
        className={cn(
          "fixed top-0 right-0 h-screen z-50",
          "w-full sm:w-[380px]",
          "bg-background border-l shadow-2xl",
          "flex flex-col",
          "transition-transform duration-300 ease-in-out will-change-transform",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Asistente IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">TRACTO AGRÍCOLA</p>
            </div>
            {isLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={clear}
              title="Nueva conversación"
              disabled={isLoading || messages.length === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="sr-only">Nueva conversación</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={close}
              title="Cerrar"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </div>
        </div>

        {/* ── Messages area ────────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <details className="mb-3 rounded-xl border bg-muted/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold">Informacion del Asistente Web</summary>
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Puede usar:</span> contexto del módulo actual,
                  consultas de productos/documentos y búsqueda web opcional.
                </p>
                <p>
                  <span className="font-medium text-foreground">Acciones de escritura:</span> solo se proponen;
                  requieren aprobación del usuario antes de ejecutarse.
                </p>
                <p>
                  <span className="font-medium text-foreground">Tip:</span> puedes abrir el workspace completo en
                  <Link href="/ai-lab" className="underline ml-1">/ai-lab</Link> para adjuntar imágenes y documentos.
                </p>
              </div>
            </details>

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Asistente unificado InventoryTW</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                    Usa contexto del módulo y puede enlazar productos, documentos y reportes.
                  </p>
                </div>
                <div className="w-full flex flex-col gap-2 mt-2">
                  {QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => sendMessage(chip)}
                      className={cn(
                        "w-full text-left text-xs rounded-xl border px-3 py-2",
                        "text-muted-foreground hover:text-foreground",
                        "hover:bg-accent hover:border-primary/30 transition-colors",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                      disabled={isLoading}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </ScrollArea>

        {/* ── Input area ───────────────────────────────────────────────────── */}
        <div className="border-t p-3 shrink-0 bg-background">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant={enableWeb ? "default" : "outline"}
              className="h-9 w-9 shrink-0"
              onClick={() => setEnableWeb((v: boolean) => !v)}
              title="Activar/desactivar búsqueda web"
            >
              <Globe className="h-4 w-4" />
              <span className="sr-only">Web</span>
            </Button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre este módulo, productos, documentos o web..."
              disabled={isLoading}
              className={cn(
                "flex-1 min-w-0 h-9 rounded-lg border bg-muted/40 px-3 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            />
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0"
                onClick={stop}
                title="Detener"
              >
                <span className="h-3 w-3 rounded-sm bg-destructive" />
                <span className="sr-only">Detener</span>
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={!input.trim()}
                title="Enviar"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Enviar</span>
              </Button>
            )}
          </form>
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            Modo web: {enableWeb ? "ON" : "OFF"} · Contexto del módulo activo
          </p>
        </div>
      </div>
    </>
  );
}
