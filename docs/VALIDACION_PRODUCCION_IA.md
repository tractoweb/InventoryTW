# Validacion Produccion IA

## Objetivo
Validar en entorno productivo que el asistente IA de InventoryTW responde con contexto real, propone acciones seguras y solo ejecuta escrituras con autorizacion humana explicita.

## Alcance
- Workspace IA: /ai-lab
- Panel lateral IA global
- API de chat: /api/ai/chat
- API de acciones: /api/ai/actions
- Flujo de aprobacion, doble confirmacion y resultado visible en chat

## Precondiciones
- Deployment en produccion completado sin errores.
- Variables IA configuradas en Amplify (Bedrock y modelo activo).
- Usuario con permisos para ver modulos de inventario y documentos.
- Datos reales disponibles: al menos 1 producto, 1 documento y stock en 1 bodega.
- Si se quiere probar bloqueo de escrituras, definir AI_ENABLE_WRITE_ACTIONS en false para ese pase.

## Criterio Go No-Go
- Go: todos los casos criticos C1 a C8 en estado OK.
- No-Go: cualquier fallo en C4, C5, C6 o C7 (seguridad y ejecucion).

## Matriz de pruebas

### C1 - Respuesta basica en AI Lab
Pasos:
1. Abrir /ai-lab.
2. Enviar: "Resumen del inventario actual".

Esperado:
- Respuesta en menos de 15 segundos.
- Texto comprensible y sin errores de formato.
- No aparece mensaje de configuracion incompleta.

Evidencia:
- Captura del hilo en /ai-lab con respuesta completa.

### C2 - Contexto de modulo y ruta
Pasos:
1. Navegar a /inventory.
2. Abrir panel lateral IA.
3. Enviar: "Que estoy viendo en esta pantalla y que puedo hacer aqui?".

Esperado:
- La respuesta menciona inventario o elementos coherentes con /inventory.
- No responde con contexto de modulo incorrecto.

Evidencia:
- Captura de panel lateral con respuesta contextual.

### C3 - Enlaces y tablas renderizadas
Pasos:
1. Solicitar: "Muestrame productos con bajo stock y dame enlaces para revisarlos".

Esperado:
- Si hay datos, aparecen tarjetas de enlaces y/o tabla estructurada.
- Los enlaces internos navegan correctamente.

Evidencia:
- Captura del resultado y navegacion al menos en 1 enlace.

### C4 - Accion propuesta con botones claros
Pasos:
1. Solicitar una accion operativa, ejemplo: "Quiero ajustar stock del producto X en bodega Y".

Esperado:
- Se muestra tarjeta de accion con botones Modificar y Aprobar y ejecutar o Ejecutar.
- Si la accion es de escritura, se marca como Escritura.

Evidencia:
- Captura de la tarjeta de accion completa.

### C5 - Modificar antes de ejecutar
Pasos:
1. En una accion propuesta, pulsar Modificar.

Esperado:
- El input se rellena con texto para editar la accion.
- No ejecuta nada automaticamente.

Evidencia:
- Captura del input precargado.

### C6 - Aprobacion y ejecucion controlada
Pasos:
1. Pulsar Aprobar y ejecutar en una accion valida.

Esperado:
- Estado visual de procesamiento.
- Mensaje final de exito o error en el chat.
- Si exito, muestra salida util (mensaje, enlace o tabla).

Evidencia:
- Captura antes y despues de ejecutar.

### C7 - Doble confirmacion en acciones sensibles
Pasos:
1. Forzar o solicitar una accion marcada con doble confirmacion.
2. Pulsar el primer boton de aprobacion.

Esperado:
- El boton cambia a Confirmar definitivamente.
- Sin segundo clic no se ejecuta la accion.

Evidencia:
- Captura del cambio de estado del boton.

### C8 - Kill switch de escritura
Pasos:
1. Ejecutar una accion de escritura con AI_ENABLE_WRITE_ACTIONS en false.

Esperado:
- La API bloquea la escritura.
- El chat refleja fallo controlado y sin efectos en datos.

Evidencia:
- Captura de respuesta de bloqueo.
- Verificacion manual de que el dato no cambio.

### C9 - Adjuntos PDF e imagen
Pasos:
1. Adjuntar un PDF con texto.
2. Adjuntar un PDF escaneado sin capa de texto.
3. Adjuntar una imagen menor a 1.5 MB.

Esperado:
- PDF con texto: extrae contexto util.
- PDF escaneado: mensaje claro indicando limitacion de extraccion.
- Imagen valida: se procesa sin romper la conversacion.

Evidencia:
- Capturas de cada caso y respuesta del asistente.

### C10 - Sugerencia de impresion
Pasos:
1. Solicitar: "Quiero imprimir etiquetas de este producto".

Esperado:
- Propone accion o enlace hacia flujo de impresion.
- Navega correctamente a la pantalla relacionada.

Evidencia:
- Captura de la sugerencia y destino final.

## Registro de ejecucion
Fecha:
Ambiente:
Usuario:
Build:

Resultados:
- C1:
- C2:
- C3:
- C4:
- C5:
- C6:
- C7:
- C8:
- C9:
- C10:

Incidencias:
-

Decision final:
- Go
- No-Go

## Acciones correctivas recomendadas
- Si falla contexto: revisar payload context y pageSnapshot.
- Si falla ejecucion: revisar /api/ai/actions y permisos de accion.
- Si falla render de tarjetas: revisar componentes de acciones en panel y AI Lab.
- Si falla adjuntos: revisar limites de tamano y extraccion de PDF.
