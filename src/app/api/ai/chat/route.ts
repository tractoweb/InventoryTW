import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => m && typeof m.role === 'string' && typeof m.content === 'string')
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .slice(-16)
    .map((m: any) => ({
      role: m.role,
      content: String(m.content).slice(0, 3000),
    }));
}

/**
 * Simple pattern-based response system
 * Provides basic conversational responses without requiring LLM/Bedrock
 */
function generateResponse(_userMessage: string): string {
  const lower = _userMessage.toLowerCase().trim();

  // Greetings
  if (/^(hola|hi|hey|buenos|buenas|saludos)/.test(lower)) {
    return 'Hola! Soy el asistente de TRACTO AGRÍCOLA. ¿En qué puedo ayudarte hoy?';
  }

  // Farewell
  if (/(adiós|hasta luego|chao|bye|gracias)/i.test(lower)) {
    return '¡Hasta luego! Si tienes más preguntas, estaré por aquí.';
  }

  // Help request
  if (/(ayuda|help|que puedes|que haces|como funciona)/i.test(lower)) {
    return `Soy el asistente de TRACTO AGRÍCOLA. Puedo ayudarte con:
• Consultas sobre productos y repuestos
• Información de inventario
• Detalles de documentos y transacciones
• Orientación general sobre el sistema

¿Qué necesitas saber?`;
  }

  // Inventory/stock question
  if (/(stock|inventario|cantidad|bodega|almacén|disponibilidad)/i.test(lower)) {
    return 'Para consultas de inventario, usa la sección de Inventario en el sistema. Ahí verás el stock actualizado por bodega y producto.';
  }

  // Document question
  if (/(documento|compra|venta|factura|ingreso|salida|movimiento|transacción)/i.test(lower)) {
    return 'Los documentos registran todas las transacciones. Puedes crearlos, consultarlos y finalizarlos en la sección de Documentos. ¿Necesitas ayuda con algo específico?';
  }

  // Product/parts search
  if (/(producto|repuesto|parte|código|búsca)/i.test(lower)) {
    return 'Para buscar productos, usa el catálogo en Inventario. Puedes buscar por código, nombre o grupo de productos.';
  }

  // Default response
  return 'Entiendo. Actualmente funciono con respuestas predefinidas. ¿Puedes intentar con preguntas sobre inventario, documentos o productos?';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages = sanitizeMessages(rawMessages);

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No hay mensajes válidos en la solicitud',
          errorType: 'INVALID_INPUT',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userMessage = messages[messages.length - 1]?.content || '';
    if (!userMessage) {
      return new Response(
        JSON.stringify({
          error: 'El mensaje del usuario está vacío',
          errorType: 'EMPTY_MESSAGE',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = generateResponse(userMessage);

    // Stream response in chunks (simulating streaming)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let idx = 0;
        const chunkSize = 40;
        const interval = setInterval(() => {
          if (idx >= response.length) {
            clearInterval(interval);
            controller.close();
            return;
          }
          const chunk = response.slice(idx, idx + chunkSize);
          controller.enqueue(encoder.encode(chunk));
          idx += chunkSize;
        }, 40);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: `Error: ${error?.message || 'Desconocido'}`,
        errorType: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
