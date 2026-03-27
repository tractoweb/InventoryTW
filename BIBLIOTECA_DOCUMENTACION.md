# 📚 BIBLIOTECA COMPLETA DE DOCUMENTACIÓN — InventoryTW

> Índice maestro de todos los archivos `.md` del proyecto con descripción, audiencia, ubicación y estado.  
> _Última actualización: 27 de marzo de 2026_

---

## 🗂️ Mapa de Archivos (18 documentos)

| # | Archivo | Ubicación | Audiencia | Estado |
|---|---------|-----------|-----------|--------|
| 1 | [README.md](#1-readmemd) | `/` | Todos | ⚠️ Desactualizado |
| 2 | [README_PROYECTO.md](#2-readme_proyectomd) | `/` | Desarrolladores | ✅ Vigente |
| 3 | [ANALISIS_COMPLETO.md](#3-analisis_completomd) | `/` | Arquitectos / Devs | ✅ Vigente |
| 4 | [PLAN_MAESTRO.md](#4-plan_maestromd) | `/` | Tech Lead / Dev | ✅ Vigente |
| 5 | [PLAN_MODULOS.md](#5-plan_modulosmd) | `/` | Desarrolladores | ✅ Vigente |
| 6 | [PROXIMOS_PASOS.md](#6-proximos_pasosmd) | `/` | Desarrolladores | ⚠️ Parcial |
| 7 | [RECOMENDACIONES.md](#7-recomendacionesmd) | `/` | Desarrolladores | ✅ Vigente |
| 8 | [RESUMEN_EJECUTIVO.md](#8-resumen_ejecutivomd) | `/` | Gerentes / Stakeholders | ✅ Vigente |
| 9 | [RESUMEN_FINAL.md](#9-resumen_finalmd) | `/` | Todos | ⚠️ Snapshot antiguo |
| 10 | [OVERVIEW_VISUAL.md](#10-overview_visualmd) | `/` | Todos | ⚠️ Snapshot antiguo |
| 11 | [COMPARATIVA_TECNICA.md](#11-comparativa_tecnicamd) | `/` | Arquitectos | ✅ Vigente |
| 12 | [QUICK_START.md](#12-quick_startmd) | `/` | Desarrolladores nuevos | ✅ Vigente |
| 13 | [INDICE_DOCUMENTACION.md](#13-indice_documentacionmd) | `/` | Todos | ⚠️ Reemplazado por este |
| 14 | [.github/copilot-instructions.md](#14-githubcopilot-instructionsmd) | `/.github/` | IA / Copilot | ✅ Vigente |
| 15 | [docs/blueprint.md](#15-docsblueprintmd) | `/docs/` | Diseñadores / Devs | ⚠️ Placeholder inicial |
| 16 | [docs/VALIDACION_PRODUCCION_IA.md](#16-docsvalidacion_produccion_iamd) | `/docs/` | QA / DevOps | ✅ Vigente |
| 17 | [public/labels/README.md](#17-publiclabelsreadmemd) | `/public/labels/` | Devs (Print) | ✅ Vigente |
| 18 | [public/vendor/README.md](#18-publicvendorreadmemd) | `/public/vendor/` | Devs (Zebra) | ✅ Vigente |

---

## 📄 Descripciones Detalladas

---

### 1. `README.md`
**Ubicación**: `/README.md`  
**Audiencia**: Todos  
**Tiempo de lectura**: 1 min  
**Estado**: ⚠️ Desactualizado (es el README genérico de Firebase Studio)

Contiene solo el placeholder de Firebase Studio (`"This is a NextJS starter in Firebase Studio"`). No refleja el proyecto real.  
**→ Acción recomendada**: Reemplazar con el contenido de `README_PROYECTO.md`.

---

### 2. `README_PROYECTO.md`
**Ubicación**: `/README_PROYECTO.md`  
**Audiencia**: Desarrolladores, nuevos integrantes  
**Tiempo de lectura**: 15–20 min  
**Estado**: ✅ Vigente

Punto de entrada técnico del proyecto. Contiene:
- Descripción del sistema (inventario multi-almacén para TRACTO AGRÍCOLA)
- Stack tecnológico: Next.js 14, AWS Amplify Gen 2, DynamoDB, Tailwind, Radix UI
- Características implementadas y pendientes
- Guía de instalación paso a paso
- Estructura de carpetas
- Estado por porcentaje de avance
- Roadmap de 12 semanas

---

### 3. `ANALISIS_COMPLETO.md`
**Ubicación**: `/ANALISIS_COMPLETO.md`  
**Audiencia**: Desarrolladores, arquitectos  
**Tiempo de lectura**: 40–50 min  
**Estado**: ✅ Vigente

Análisis técnico profundo. Contiene:
- Arquitectura Amplify y los 30+ modelos NoSQL (User, Product, Stock, Kardex, Document, DocumentItem, Customer, Client, etc.)
- Relaciones entre modelos (FK, GSI, índices secundarios)
- Problemas identificados: autenticación débil, módulos faltantes, referencias SQL eliminadas
- Plan de implementación fase a fase
- Estructura del modelo `Kardex` con todos sus campos

---

### 4. `PLAN_MAESTRO.md`
**Ubicación**: `/PLAN_MAESTRO.md`  
**Audiencia**: Tech Lead, desarrolladores senior  
**Tiempo de lectura**: 45–90 min  
**Estado**: ✅ Vigente (documento más completo del backlog)

Backlog integral 2026. Contiene:
- Estado actual de rutas y módulos (`/documents`, `/kardex`, `/stock`, `/users`, `/reports`, etc.)
- Templates estándar para cada tipo de módulo: Lista, Detalle, Formulario, Reporte, PDF/Print
- Backlog completo módulo por módulo con lógicas y templates requeridos
- **Exclusión explícita**: módulo de impresión de etiquetas (ZPL/Zebra) no está incluido

---

### 5. `PLAN_MODULOS.md`
**Ubicación**: `/PLAN_MODULOS.md`  
**Audiencia**: Desarrolladores  
**Tiempo de lectura**: 30 min  
**Estado**: ✅ Vigente

Plan de implementación orientado a servicios. Contiene:
- Estado actual de los 4 servicios implementados: `auth-service`, `kardex-service`, `document-service`, `inventory-service`
- Lista de componentes React a crear por fase
- Fase 1: Autenticación (login-form, auth-provider, useAuth hook)
- Fase 2: Dashboard y productos
- Fase 3: Documentos y kardex
- TODOs por servicio (bcrypt, JWT, 2FA, reportes PDF, exportación Excel)

---

### 6. `PROXIMOS_PASOS.md`
**Ubicación**: `/PROXIMOS_PASOS.md`  
**Audiencia**: Desarrolladores  
**Tiempo de lectura**: 20 min  
**Estado**: ⚠️ Parcialmente implementado (bcrypt/JWT ya integrados en codebase)

Checklist de tareas con código concreto. Contiene:
- Tarea 1.1: Implementar bcrypt para hash de passwords
- Tarea 1.2: Implementar JWT con expiración 8h y middleware `verify-token.ts`
- Comandos `pnpm add` necesarios
- Snippets de código listos para copiar/pegar

---

### 7. `RECOMENDACIONES.md`
**Ubicación**: `/RECOMENDACIONES.md`  
**Audiencia**: Desarrolladores  
**Tiempo de lectura**: 30 min  
**Estado**: ✅ Vigente

Guía de best practices y mejoras de seguridad. Contiene:
- Hashing de passwords con bcrypt (código completo)
- JWT con expiración (código completo, variables de entorno requeridas)
- Rate limiting
- Variables de entorno: `JWT_SECRET`, `JWT_EXPIRATION`
- Dependencias a agregar: `bcrypt`, `jsonwebtoken`

---

### 8. `RESUMEN_EJECUTIVO.md`
**Ubicación**: `/RESUMEN_EJECUTIVO.md`  
**Audiencia**: Gerentes, stakeholders, líderes de proyecto  
**Tiempo de lectura**: 15 min  
**Estado**: ✅ Vigente

Visión no técnica del proyecto. Contiene:
- Capacidades del sistema (1000+ productos, multi-almacén, Kardex, roles)
- Qué está completado vs pendiente (tabla visual)
- Prioridades inmediatas
- Plan por fases y métricas de progreso

---

### 9. `RESUMEN_FINAL.md`
**Ubicación**: `/RESUMEN_FINAL.md`  
**Audiencia**: Todos  
**Tiempo de lectura**: 10 min  
**Estado**: ⚠️ Snapshot de una sesión anterior

Resumen de lo hecho en la primera sesión de implementación. Contiene:
- 5 servicios backend creados
- 5 nuevos modelos Amplify añadidos (SessionConfig, ApplicationSettings, AuditLog, DocumentNumber, KardexHistory)
- Los 8 documentos .md generados
- Tabla de completitud por área

---

### 10. `OVERVIEW_VISUAL.md`
**Ubicación**: `/OVERVIEW_VISUAL.md`  
**Audiencia**: Todos  
**Tiempo de lectura**: 5 min  
**Estado**: ⚠️ Snapshot antiguo (cifras desactualizadas)

Diagramas ASCII del estado del proyecto en texto. Contiene:
- Dashboard visual con porcentajes de completitud
- Timeline semana a semana (12 semanas proyectadas)
- Muestra "85% completado" — cifra de la sesión inicial, hoy el proyecto está mucho más avanzado

---

### 11. `COMPARATIVA_TECNICA.md`
**Ubicación**: `/COMPARATIVA_TECNICA.md`  
**Audiencia**: Arquitectos, tomadores de decisión técnica  
**Tiempo de lectura**: 10 min  
**Estado**: ✅ Vigente

Justificación de la elección tecnológica. Contiene:
- Tabla comparativa: AWS Amplify vs SQL (PostgreSQL/MySQL) vs Firebase
- Pros/Contras de Amplify: serverless, auto-scaling, sin gestión de servidor, vendor lock-in
- Estimación de costos con 100 usuarios activos (~$150–200/mes)
- Por qué Amplify es mejor para el contexto de TRACTO AGRÍCOLA

---

### 12. `QUICK_START.md`
**Ubicación**: `/QUICK_START.md`  
**Audiencia**: Desarrolladores nuevos  
**Tiempo de lectura**: 5 min  
**Estado**: ✅ Vigente

Guía de inicio en 5 minutos. Contiene:
- Requisitos previos (Node 18+, pnpm)
- Comandos de instalación y configuración rápida
- Variables de entorno mínimas (JWT_SECRET, SMTP opcional)
- Guía de lectura de documentación por perfil (15 min, 1 hora, 2 horas)

---

### 13. `INDICE_DOCUMENTACION.md`
**Ubicación**: `/INDICE_DOCUMENTACION.md`  
**Audiencia**: Todos  
**Tiempo de lectura**: 5 min  
**Estado**: ⚠️ Reemplazado por `BIBLIOTECA_DOCUMENTACION.md` (este archivo)

Índice original de los primeros 8 documentos. Contiene rutas de lectura por perfil (Gerente, Desarrollador, Arquitecto). Sigue siendo válido para los documentos que cubre.

---

### 14. `.github/copilot-instructions.md`
**Ubicación**: `/.github/copilot-instructions.md`  
**Audiencia**: GitHub Copilot / IA  
**Tiempo de lectura**: 3 min  
**Estado**: ✅ Vigente

Instrucciones del agente Copilot para este repositorio. Contiene:
- Overview del proyecto para el contexto de IA
- Patrones de arquitectura: Server Actions, Services Layer, Amplify Client
- Workflow de desarrollo (pnpm install → ampx sandbox → pnpm dev)
- Convenciones: Zod, React Hook Form, TanStack Table, Recharts
- Problemas comunes (rutas faltantes, errores de Amplify)
- Referencias a documentos clave

---

### 15. `docs/blueprint.md`
**Ubicación**: `/docs/blueprint.md`  
**Audiencia**: Diseñadores, desarrolladores frontend  
**Tiempo de lectura**: 3 min  
**Estado**: ⚠️ Placeholder inicial (Firebase Studio)

Blueprint de diseño original generado por Firebase Studio. Contiene:
- Nombre original de la app: "InventoryEdge"
- Paleta de colores: azul profundo (#3F51B5), gris claro (#F0F2F5), teal (#009688)
- Tipografía: Inter
- Features originales: Dashboard, CRUD inventario, AWS RDS (ya migrado a DynamoDB)
- **Nota**: La referencia a AWS RDS ya no aplica (sistema usa DynamoDB vía Amplify)

---

### 16. `docs/VALIDACION_PRODUCCION_IA.md`
**Ubicación**: `/docs/VALIDACION_PRODUCCION_IA.md`  
**Audiencia**: QA, DevOps, testers  
**Tiempo de lectura**: 15 min  
**Estado**: ✅ Vigente

Protocolo completo de validación del asistente IA en producción. Contiene:
- **8 casos críticos (C1–C8)**: respuesta básica, contexto de módulo, tablas/enlaces, seguridad de escrituras, ejecución con confirmación, doble confirmación, bloqueo sin `AI_ENABLE_WRITE_ACTIONS`, error graceful
- Criterio Go/No-Go: C4, C5, C6, C7 son bloqueantes
- Precondiciones: variables Bedrock activas, datos reales en DB
- Scopea: `/ai-lab`, panel flotante IA, `/api/ai/chat`, `/api/ai/actions`

---

### 17. `public/labels/README.md`
**Ubicación**: `/public/labels/README.md`  
**Audiencia**: Desarrolladores del módulo de impresión  
**Tiempo de lectura**: 2 min  
**Estado**: ✅ Vigente

Instrucciones para logos en etiquetas ZPL. Contiene:
- Cómo agregar logo para preview web (SVG o PNG en `/public/labels/`)
- Cómo agregar logo ZPL para impresión (`logo.zpl` / `logo-compat.zpl`)
- Nota sobre problemas de compresión `:Z64:` en impresoras Zebra GC420t USB

---

### 18. `public/vendor/README.md`
**Ubicación**: `/public/vendor/README.md`  
**Audiencia**: Desarrolladores del módulo Zebra  
**Tiempo de lectura**: 2 min  
**Estado**: ✅ Vigente

Instrucciones para el SDK de Zebra BrowserPrint. Contiene:
- Dónde colocar el archivo `BrowserPrint-3.1.250.min.js`
- Por qué se sirve localmente (evitar bloqueo Mixed Content en HTTPS)
- Requisito: servicio Zebra Browser Print instalado en la PC que imprime
- Troubleshooting: archivo no encontrado, listas de impresoras vacías en HTTPS

---

## 🔄 Estado de Vigencia

| Estado | Significado |
|--------|-------------|
| ✅ Vigente | Refleja la arquitectura y código actual |
| ⚠️ Parcial | Parte del contenido ya fue implementado; revisar antes de usar |
| ⚠️ Snapshot | Refleja el estado en una sesión pasada; útil como referencia histórica |
| ⚠️ Desactualizado | No refleja el proyecto actual; ignorar o reemplazar |

---

## 📌 Guías de Lectura Rápida

### Si eres desarrollador nuevo (1 hora)
1. `QUICK_START.md` → levantar el ambiente
2. `README_PROYECTO.md` → entender el sistema
3. `ANALISIS_COMPLETO.md` → conocer los modelos y relaciones
4. `PLAN_MAESTRO.md` secciones 0 y 1 → estado actual y templates

### Si vas a trabajar en el módulo IA
1. `docs/VALIDACION_PRODUCCION_IA.md` → protocolo de pruebas
2. `.github/copilot-instructions.md` → contexto para el agente
3. `src/lib/ai/assistant-shared.ts` + `src/app/api/ai/` → código fuente

### Si eres Tech Lead / quieres el backlog completo
1. `PLAN_MAESTRO.md` (completo)
2. `ANALISIS_COMPLETO.md`
3. `RECOMENDACIONES.md`

---

_Este archivo reemplaza y amplía `INDICE_DOCUMENTACION.md`._
