'use client';

import * as React from 'react';
import { Bot, Send, Loader2, User, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTED = [
  '¿Cuáles son los productos con menor stock?',
  '¿Cómo creo un documento de compra?',
  '¿Qué es el Kardex y para qué sirve?',
  'Explica el flujo de un documento de venta',
  '¿Cómo ajusto el stock de un producto?',
];

export default function AILabPage() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: message };
    const asstId = `a-${Date.now() + 1}`;

    setMessages((prev) => [...prev, userMsg, { id: asstId, role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: { totalProducts: '1.243+', system: 'InventoryTW' },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errText =
          res.status === 503
            ? '⚠️ El asistente de IA no está configurado aún. Contacta al administrador para activar las variables de entorno de Bedrock en Amplify Console.'
            : `❌ ${data?.error ?? 'Error al procesar tu consulta'}`;
        setMessages((prev) =>
          prev.map((m) => (m.id === asstId ? { ...m, content: errText } : m))
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId ? { ...m, content: data.response ?? '(sin respuesta)' } : m
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const modelId =
    process.env.NEXT_PUBLIC_AI_MODEL_LABEL ?? 'Claude 3 Haiku';

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            InventoryTW AI Lab
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Asistente de IA para TRACTO AGRÍCOLA · Consultas sobre inventario, documentos y operación del sistema
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
                        msg.content
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
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu consulta… (Enter para enviar, Shift+Enter para nueva línea)"
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
              <CardTitle className="text-sm">Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs p-3 pt-0">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Productos</span>
                <Badge variant="secondary" className="text-xs">1.243+</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Modelos BD</span>
                <Badge variant="secondary" className="text-xs">30</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Modelo IA</span>
                <Badge variant="default" className="text-xs">Claude 3</Badge>
              </div>
            </CardContent>
          </Card>

          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setMessages([])}
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
