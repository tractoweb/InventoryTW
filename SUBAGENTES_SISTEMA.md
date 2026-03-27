# 🤖 SUB-AGENTES DEL SISTEMA — InventoryTW

> Mapa completo de todos los sub-agentes disponibles, los ya implementados y los que se pueden programar para sistematizar tareas en el código.  
> _Última actualización: 27 de marzo de 2026_

---

## 1. Panorama General

El sistema tiene **tres capas de agentes**:

| Capa | Tipo | Dónde viven | Para qué |
|------|------|-------------|----------|
| **A** | Agentes de operaciones IA (ya implementados) | `src/app/api/ai/` | Ejecutar operaciones reales en la DB desde el chat |
| **B** | GitHub Copilot Custom Agents | `.github/` + `.vscode/` | Sistematizar tareas de desarrollo: codegen, revisión, migración |
| **C** | GitHub Actions Workflows | `.github/workflows/` | Automatización de CI/CD, deploys, scripts recurrentes |

---

## 2. Capa A — Agentes de Operaciones IA (implementados)

Viven en `src/app/api/ai/actions/route.ts`.  
Se invocan desde el chat en `/ai-lab` o el panel flotante cuando el asistente propone una acción.

### 2.1 `queryDB` — Agente de consulta
**Acceso**: CASHIER (nivel 0, cualquier usuario)  
**Gate**: Sin restricción de escritura (lectura libre)  
**Tablas permitidas**: 15 — Product, Stock, Kardex, Document, DocumentItem, Customer, Client, Warehouse, DocumentType, ProductGroup, Tax, Payment, Barcode, ProductTax, DocumentItemTax

```ts
// Ejemplo de params:
{
  table: 'Stock',
  productId: 123,
  warehouseId: 1,
  limit: 50
}
```
**Qué hace**: Consulta la tabla indicada con filtros opcionales y devuelve una tabla estructurada visible en el chat.

---

### 2.2 `adjustStock` — Agente de ajuste de inventario
**Acceso**: CASHIER (nivel 0)  
**Gate**: `AI_ENABLE_WRITE_ACTIONS=true` + confirmación del usuario  
**Acción subyacente**: `src/actions/adjust-stock.ts`

```ts
{
  productId: 123,
  warehouseId: 1,
  quantity: 50,
  reason: "Conteo físico"
}
```
**Qué hace**: Actualiza el stock del producto en la bodega indicada, crea entrada en Kardex con tipo AJUSTE, muestra resultado anterior vs nuevo.

---

### 2.3 `createProduct` — Agente de creación de producto
**Acceso**: ADMIN (nivel 1)  
**Gate**: `AI_ENABLE_WRITE_ACTIONS=true` + **doble confirmación** del usuario  
**Acción subyacente**: `src/actions/create-product.ts`

```ts
{
  name: "Filtro de aceite XYZ",
  code: "FILT-001",
  cost: 12.50,
  price: 18.00,
  productGroupId: 5
}
```
**Qué hace**: Crea el producto en DynamoDB. Requiere doble confirmación por seguridad.

---

### 2.4 `updateProduct` — Agente de actualización de producto
**Acceso**: ADMIN (nivel 1)  
**Gate**: `AI_ENABLE_WRITE_ACTIONS=true` + confirmación  
**Acción subyacente**: `amplifyClient.models.Product.update()`

```ts
{
  productId: 123,
  price: 22.00,
  cost: 14.00,
  name: "Filtro de aceite XYZ v2"
}
```
**Qué hace**: Actualiza campos del producto (nombre, código, precio, costo, descripción, grupo).

---

### 2.5 `deleteProduct` — Agente de eliminación (soft-delete)
**Acceso**: ADMIN (nivel 1)  
**Gate**: `AI_ENABLE_WRITE_ACTIONS=true` + **doble confirmación**  
**Acción subyacente**: `src/actions/delete-product.ts` → pone `isEnabled=false`

```ts
{
  productId: 123
}
```
**Qué hace**: Desactiva el producto (no borra físicamente). Requiere doble confirmación.

---

### 2.6 `updateDocumentMetadata` — Agente de edición de documento
**Acceso**: CASHIER (nivel 0)  
**Gate**: `AI_ENABLE_WRITE_ACTIONS=true` + confirmación  
**Acción subyacente**: `src/actions/update-document-metadata.ts`

```ts
{
  documentId: 456,
  note: "Corrección de cliente",
  clientName: "Empresa ABC",
  clientId: 78
}
```
**Qué hace**: Actualiza nota, cliente o referencia de un documento sin revertir su stock ni Kardex.

---

### 2.7 Tabla resumen — Agentes IA activos

| Operación | Nivel mínimo | Confirmación | Doble conf. | Estado |
|-----------|-------------|--------------|-------------|--------|
| `queryDB` | CASHIER | No | No | ✅ Activo |
| `adjustStock` | CASHIER | Sí | No | ✅ Activo |
| `createProduct` | ADMIN | Sí | **Sí** | ✅ Activo |
| `updateProduct` | ADMIN | Sí | No | ✅ Activo |
| `deleteProduct` | ADMIN | Sí | **Sí** | ✅ Activo |
| `updateDocumentMetadata` | CASHIER | Sí | No | ✅ Activo |

**Variable de control** (Amplify Console → Environment variables):
```
AI_ENABLE_WRITE_ACTIONS=true   # habilita escrituras
AI_ENABLE_WRITE_ACTIONS=false  # solo lectura (queryDB igual funciona)
```

---

## 3. Capa B — GitHub Copilot Custom Agents (programables)

Estos son agentes de **asistencia al desarrollo** que viven en archivos `.md` especiales y GitHub Copilot los lee automáticamente. Sirven para sistematizar tareas repetitivas de código.

### 3.1 Ya existente: `.github/copilot-instructions.md`
Instrucciones globales para Copilot en TODO el repositorio. Ya está configurado con:
- Stack del proyecto, patrones, convenciones
- Cómo usar `amplifyClient`, Server Actions, Zod
- Errores comunes y sus soluciones

### 3.2 Cómo crear agents `.prompt.md` (nuevos agentes)

Los archivos `.prompt.md` son agentes que se invocan con `@workspace` o desde el panel de Copilot. Estructura:

```markdown
---
mode: agent          # "agent" para agentes autónomos, "ask" para consultas
description: Descripción breve del agente
tools:               # herramientas que puede usar
  - codebase
  - run_terminal
---

# Instrucciones del agente

Tu tarea es...
```

**Dónde colocarlos**:
- `.github/` → disponibles en todo el repo
- `.vscode/` → solo disponibles localmente (no se commitean si están en .gitignore)

---

### 3.3 Agentes Copilot a programar (recomendados para InventoryTW)

#### Agente: `codegen-service.prompt.md`
**Propósito**: Generar un service completo para un nuevo modelo Amplify  
**Activar con**: "Genera el service para el modelo X"

```markdown
---
mode: agent
description: Genera src/services/{model}-service.ts siguiendo el patrón del proyecto
tools: [codebase]
---

Lee amplify/data/resource.ts y encuentra el modelo indicado.
Genera src/services/{model}-service.ts con funciones list, get, create, update, delete.
Usa amplifyClient, sigue el patrón de src/services/product-service.ts.
```

---

#### Agente: `codegen-action.prompt.md`
**Propósito**: Generar una Server Action para una operación específica

```markdown
---
mode: agent
description: Genera src/actions/{action}.ts con validación Zod y requireSession
tools: [codebase]
---

Genera una Server Action en src/actions/{action}.ts.
Debe: importar requireSession, validar con Zod, usar amplifyClient.
Sigue el patrón de src/actions/adjust-stock.ts.
```

---

#### Agente: `codegen-page-list.prompt.md`
**Propósito**: Generar página de listado (tabla paginada) para un módulo

```markdown
---
mode: agent
description: Genera src/app/{module}/page.tsx con tabla TanStack, filtros y paginación
tools: [codebase]
---

Lee PLAN_MAESTRO.md sección "Template: Lista".
Genera src/app/{module}/page.tsx con:
- TanStack Table paginada
- Barra de filtros (búsqueda, fecha, estado)
- Fetch via server action
- Columnas con acciones (editar, ver detalle)
```

---

#### Agente: `db-audit.prompt.md`
**Propósito**: Auditar que todas las queries usen amplifyClient (sin referencias a SQL)

```markdown
---
mode: agent
description: Verifica que no haya referencias a db-connection o SQL en actions/services
tools: [codebase, run_terminal]
---

Busca en src/actions/ y src/services/ cualquier import de:
- db-connection
- @prisma/client
- mysql2, pg, knex
Reporta archivos afectados y propón el equivalente Amplify.
```

---

#### Agente: `ai-op-add.prompt.md`
**Propósito**: Añadir una nueva operación al agente IA

```markdown
---
mode: agent
description: Agrega una nueva operación a src/app/api/ai/actions/route.ts y chat/route.ts
tools: [codebase]
---

Para agregar la operación {operationName}:
1. Lee src/app/api/ai/actions/route.ts y entende el patrón de operaciones existentes
2. Crea el Zod schema {OperationName}Params
3. Agrega el case handler con requireSession(ACCESS_LEVELS.X)
4. Lee src/app/api/ai/chat/route.ts y agrega detección de intención en buildActionProposals()
5. Lee src/lib/ai/assistant-shared.ts y agrega la operación al union type
```

---

#### Agente: `migration-check.prompt.md`
**Propósito**: Verificar que los scripts de migración de datos sean correctos

```markdown
---
mode: agent
description: Valida scripts en src/scripts/ contra el schema Amplify actual
tools: [codebase]
---

Lee amplify/data/resource.ts para conocer los modelos actuales.
Lee cada archivo en src/scripts/ y verifica:
- Campos usados existen en el modelo
- Tipos son compatibles
- FK referencias a modelos que existen
Reporta inconsistencias.
```

---

### 3.4 Cómo crear un archivo `.instructions.md` (scoped)

Las instrucciones scoped se aplican solo a ciertos archivos según `applyTo`:

```markdown
---
applyTo: "src/actions/**"
---

Toda Server Action debe:
1. Comenzar con `'use server'`
2. Llamar `requireSession(ACCESS_LEVELS.X)` como primera línea
3. Validar parámetros con Zod antes de cualquier operación
4. Retornar `{ success: true, ... }` o `{ success: false, error: string }`
5. Nunca exponer datos internos de DynamoDB directamente
```

Colocar en `.github/actions.instructions.md` para que Copilot lo aplique automáticamente.

---

## 4. Capa C — GitHub Actions Workflows (CI/CD Agents)

Viven en `.github/workflows/*.yml`. Son agentes de automatización que corren en GitHub.

### 4.1 Existente: `deploy.yml` (deshabilitado)
El workflow actual está deshabilitado (solo hace `echo "Legacy deploy disabled"`).

### 4.2 Workflows a crear

#### `lint-typecheck.yml` — Agente de calidad de código
```yaml
name: Lint & TypeCheck
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm exec tsc --noEmit
```

#### `amplify-preview.yml` — Agente de preview por PR
```yaml
name: Amplify Preview
on: [pull_request]
# Deployar ambiente de preview por cada Pull Request
# Requiere: token Amplify + permisos IAM
```

#### `db-export-backup.yml` — Agente de respaldo programado
```yaml
name: DB Backup
on:
  schedule:
    - cron: '0 3 * * *'   # 3am diario
# Exportar DynamoDB → S3 via AWS CLI
# Notificar por email si falla
```

#### `label-generation-test.yml` — Agente de validación ZPL
```yaml
name: ZPL Label Validation
on: [push]
# Correr validación de archivos .zpl en public/labels/
# Verificar que logo.zpl y logo-compat.zpl son válidos
```

---

## 5. Operaciones IA a Implementar (próximas)

Nuevas operaciones que se pueden agregar a `actions/route.ts` siguiendo el patrón existente:

| # | Operación | Descripción | Nivel | Dificultad |
|---|-----------|-------------|-------|------------|
| 1 | `generateDocumentReport` | Exportar reporte de documento a tabla estructurada | CASHIER | Baja |
| 2 | `searchProducts` | Buscar productos por nombre/código (más flexible que queryDB) | CASHIER | Baja |
| 3 | `getKardexByProduct` | Historial Kardex de un producto con GSI (más eficiente) | CASHIER | Media |
| 4 | `createDocument` | Crear documento borrador desde el chat | ADMIN | Alta |
| 5 | `finalizeDocument` | Finalizar documento (postea Stock + Kardex) | ADMIN | Alta |
| 6 | `transferStock` | Mover stock entre bodegas | ADMIN | Media |
| 7 | `generateValuationReport` | Valorización de inventario completo | ADMIN | Media |
| 8 | `bulkUpdatePrices` | Actualizar precios por grupo de productos | MASTER | Alta |

---

## 6. Flujo de Implementación de un Nuevo Agente IA

Para agregar una nueva operación al asistente IA, seguir estos 4 pasos:

```
1. src/lib/ai/assistant-shared.ts
   → Agregar nombre al union type de `execute.operation`

2. src/app/api/ai/actions/route.ts
   → Crear Zod schema {OperationName}Params
   → Agregar case handler con requireSession() + lógica + response

3. src/app/api/ai/chat/route.ts
   → En buildSystemPrompt(): documentar parámetros de la operación
   → En buildActionProposals(): agregar regex de detección de intención

4. docs/VALIDACION_PRODUCCION_IA.md
   → Agregar caso de prueba C{n} para la nueva operación
```

---

## 7. Árbol de Archivos de Agentes

```
InventoryTW/
├── .github/
│   ├── copilot-instructions.md          ← ✅ Instrucciones globales Copilot
│   ├── copilot-agents/                  ← 📁 CREAR (para agentes .prompt.md)
│   │   ├── codegen-service.prompt.md    ← Por crear
│   │   ├── codegen-action.prompt.md     ← Por crear
│   │   ├── codegen-page-list.prompt.md  ← Por crear
│   │   ├── db-audit.prompt.md           ← Por crear
│   │   ├── ai-op-add.prompt.md          ← Por crear
│   │   └── migration-check.prompt.md    ← Por crear
│   └── workflows/
│       ├── deploy.yml                   ← ⚠️ Deshabilitado
│       ├── lint-typecheck.yml           ← Por crear
│       └── amplify-preview.yml          ← Por crear
│
└── src/app/api/ai/
    ├── chat/route.ts                    ← ✅ Prompt sistema + propuestas de acción
    └── actions/route.ts                 ← ✅ 6 operaciones implementadas
```

---

## 8. Variable de Entorno de Referencia

```env
# Amplify Console → App → Environment variables

# IA - Bedrock
BEDROCK_ACCESS_KEY_ID=...
BEDROCK_SECRET_ACCESS_KEY=...
BEDROCK_REGION=us-east-1
NEXT_PUBLIC_AI_MODEL_LABEL=Claude 3.5 Sonnet

# IA - Control de escrituras
AI_ENABLE_WRITE_ACTIONS=true     # habilitar operaciones de escritura IA
```

---

_Ver también: `BIBLIOTECA_DOCUMENTACION.md` para el índice completo de documentos._
