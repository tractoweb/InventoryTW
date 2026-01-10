# InventoryTW - Sistema de Gestión de Inventario

> Sistema completo de gestión de inventario para **TRACTO AGRÍCOLA** construido con Next.js 14 y AWS Amplify.

## 📖 Índice

- [Descripción General](#descripción-general)
- [Características](#características)
- [Tecnologías](#tecnologías)
- [Instalación](#instalación)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Documentación](#documentación)
- [Estado del Proyecto](#estado-del-proyecto)
- [Roadmap](#roadmap)

---

## 📋 Descripción General

InventoryTW es un sistema moderno de gestión de inventario diseñado para gestionar:

- **1000+ productos** con códigos, barcodes y grupos
- **Múltiples almacenes** con sincronización de stock
- **Documentos de transacción** (compras, ventas, ajustes)
- **Kardex completo** (auditoría de cada movimiento)
- **Reportes de valuación** de inventario
- **Control de acceso** por usuarios con diferentes roles

---

## ✨ Características

### ✅ Implementadas
- [x] Modelo de datos NoSQL completo (30 modelos)
- [x] Servicios backend (auth, documentos, kardex, inventario)
- [x] API Amplify integrada
- [x] Documentación técnica completa

### 🔄 En Desarrollo
- [ ] Interfaz de usuario (componentes React)
- [ ] Página de login
- [ ] Dashboard principal
- [ ] CRUD de productos
- [ ] Ingreso de documentos

### 📋 Por Hacer
- [ ] Módulo de Kardex avanzado
- [ ] Reportes PDF/Excel
- [ ] Gestor de usuarios
- [ ] Configuración de la aplicación
- [ ] Sincronización offline

---

## 🛠️ Tecnologías

```json
{
  "frontend": "Next.js 14.2.35",
  "ui": "Tailwind CSS + Radix UI",
  "backend": "AWS Amplify (GraphQL + DynamoDB)",
  "validation": "Zod",
  "forms": "React Hook Form",
  "tables": "TanStack React Table",
  "charts": "Recharts"
}
```

---

## 🚀 Instalación

### Requisitos
- Node.js 18+
- pnpm (o npm/yarn)
- AWS Amplify CLI (`npm install -g @aws-amplify/cli`)

### Pasos

```bash
# 1. Clonar el repositorio
git clone <repo>
cd InventoryTW-main

# 2. Instalar dependencias
pnpm install

# 3. Configurar Amplify
npx ampx sandbox

# 4. Variables de entorno
cp .env.example .env.local

# 5. Ejecutar en desarrollo
pnpm run dev

# 6. Abrir navegador
# http://localhost:3000
```

### Variables de Entorno Requeridas
```env
# Amplify
NEXT_PUBLIC_AMPLIFY_REGION=us-east-1
NEXT_PUBLIC_AMPLIFY_API_KEY=your_api_key

# JWT (después de implementar)
JWT_SECRET=your_secret_key_very_long
JWT_EXPIRATION=8h
```

---

## 📁 Estructura del Proyecto

```
InventoryTW-main/
├── amplify/                      # Configuración AWS Amplify
│   ├── backend.ts
│   ├── auth/
│   │   └── resource.ts          # Configuración de autenticación
│   └── data/
│       └── resource.ts          # Schema de base de datos (30 modelos)
│
├── src/
│   ├── actions/                 # Server actions (actualizadas para Amplify)
│   │   ├── auth/
│   │   ├── users/
│   │   ├── products/
│   │   ├── documents/
│   │   └── kardex/
│   │
│   ├── services/                # Servicios backend ✅ IMPLEMENTADOS
│   │   ├── amplify-config.ts    # Configuración centralizada
│   │   ├── auth-service.ts      # Autenticación
│   │   ├── document-service.ts  # Documentos
│   │   ├── kardex-service.ts    # Kardex (auditoría)
│   │   ├── inventory-service.ts # Productos y stock
│   │   └── user-service.ts      # (por implementar)
│   │
│   ├── components/              # Componentes React
│   │   ├── auth/                # (por hacer)
│   │   ├── layout/
│   │   ├── dashboard/           # (por hacer)
│   │   ├── products/            # (por hacer)
│   │   ├── documents/           # (por hacer)
│   │   ├── kardex/              # (por hacer)
│   │   ├── ui/                  # ✅ Componentes Radix UI
│   │   └── icons.tsx
│   │
│   ├── app/                     # Páginas Next.js
│   │   ├── login/               # (por hacer)
│   │   ├── dashboard/           # (por hacer)
│   │   ├── products/            # (por hacer)
│   │   ├── documents/           # (por hacer)
│   │   ├── kardex/              # (por hacer)
│   │   ├── settings/            # (por hacer)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── lib/
│   │   ├── amplify-config.ts    # ✅ Configuración Amplify
│   │   ├── data/                # ✅ JSON con datos existentes (30 archivos)
│   │   ├── utils.ts
│   │   ├── types.ts
│   │   └── constants.ts
│   │
│   └── hooks/
│       ├── use-auth.ts          # (por hacer)
│       ├── use-debounce.ts      # ✅
│       ├── use-mobile.tsx       # ✅
│       └── use-toast.ts         # ✅
│
├── docs/
│   └── blueprint.md             # Diseño original
│
├── ANALISIS_COMPLETO.md         # ✅ Análisis técnico detallado
├── PLAN_MODULOS.md              # ✅ Plan de implementación
├── RECOMENDACIONES.md           # ✅ Best practices y mejoras
├── RESUMEN_EJECUTIVO.md         # ✅ Resumen general
├── README.md                    # Este archivo
│
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── apphosting.yaml
```

---

## 📚 Documentación

Este proyecto incluye 4 documentos de referencia:

### 1. **RESUMEN_EJECUTIVO.md** 📊
Visión general del proyecto, estado actual, prioridades y timeline.
- Quién debe leer: Product Manager, stakeholders
- Tiempo: 10-15 minutos

### 2. **ANALISIS_COMPLETO.md** 🔍
Análisis técnico profundo de la estructura, problemas y datos.
- Quién debe leer: Arquitectos, desarrolladores senior
- Tiempo: 30-45 minutos

### 3. **PLAN_MODULOS.md** 🗺️
Plan detallado de implementación módulo por módulo.
- Quién debe leer: Desarrolladores
- Tiempo: 45-60 minutos

### 4. **RECOMENDACIONES.md** 💡
Guía práctica de mejoras, seguridad, performance y features.
- Quién debe leer: Desarrolladores, DevOps
- Tiempo: 30-45 minutos

---

## 🎯 Estado del Proyecto

### Porcentaje de Completitud

| Área | Completitud | Estado |
|------|-------------|--------|
| **Diseño de BD** | 100% | ✅ Done |
| **Servicios Backend** | 100% | ✅ Done |
| **Seguridad** | 10% | 🔴 Crítico |
| **Interfaz de Usuario** | 5% | 🔴 Crítico |
| **Migración de Datos** | 0% | 🔴 Crítico |
| **Testing** | 0% | 🟡 Importante |
| **Documentación** | 100% | ✅ Done |

### Tareas Críticas (Bloquean progreso)

- [ ] Implementar hash de passwords (bcrypt)
- [ ] Crear script de migración de datos
- [ ] Implementar página de login
- [ ] Crear SessionProvider

---

## 🗺️ Roadmap

### Semana 1-2: Cimientos 🏗️
- Implementar bcrypt en auth-service
- Crear script migrate-amplify.ts
- Implementar login page
- Crear SessionProvider + Protected routes

### Semana 3-4: Interfaz Básica 🎨
- Dashboard principal
- Listado de productos
- Búsqueda de productos
- Gestión de barcodes

### Semana 5-6: Módulo Productos 📦
- CRUD completo de productos
- Importación en lote
- Control de stock
- Grupos de productos

### Semana 7-8: Módulo Documentos 📄
- Ingreso de documentos (compras)
- Salida de productos (ventas)
- Auto-numeración
- Cálculo de totales e impuestos

### Semana 9-10: Kardex 📊
- Vista de Kardex general
- Kardex por producto
- Valuación de inventario
- Reportes

### Semana 11-12: Pulido 🎁
- Gestión de usuarios

- Testing
- Deploy

- [ ] Hash de passwords con bcrypt
- [ ] JWT con expiración
Ver [RECOMENDACIONES.md](RECOMENDACIONES.md#seguridad) para detalles.


## 🚀 Deploy

### Preparar para Producción

1. **Variables de entorno**
```bash
NEXT_PUBLIC_AMPLIFY_API_KEY=prod_api_key
JWT_SECRET=prod_secret_very_long_and_random
NODE_ENV=production
```

```



## 📞 Soporte

### Documentación
- 📄 [Análisis Completo](ANALISIS_COMPLETO.md)
- 🗺️ [Plan de Módulos](PLAN_MODULOS.md)
- 💡 [Recomendaciones](RECOMENDACIONES.md)
- 📊 [Resumen Ejecutivo](RESUMEN_EJECUTIVO.md)

### Enlaces Útiles
- [AWS Amplify Docs](https://docs.amplify.aws/)
- [Next.js Docs](https://nextjs.org/docs)
- [Radix UI Docs](https://www.radix-ui.com/docs/primitives/overview/introduction)

### Contacto
- [Tu nombre / email]
- [Equipo de desarrollo]

---

## 📝 Licencia

[Definir licencia]

---

## 🎓 Créditos

Desarrollado para **TRACTO AGRÍCOLA** por [Nombre del equipo]

Último actualizado: Enero 2025

---

## ✅ Checklist para Contribuidores

Si vas a trabajar en este proyecto:

- [ ] Leer RESUMEN_EJECUTIVO.md
- [ ] Leer ANALISIS_COMPLETO.md
- [ ] Leer PLAN_MODULOS.md
- [ ] Instalar dependencias: `pnpm install`
- [ ] Configurar Amplify: `npx ampx sandbox`
- [ ] Crear rama feature: `git checkout -b feature/nombre`
- [ ] Mantener commits limpios
- [ ] Actualizar documentación

---

## 🚨 Problemas Comunes

### "Module not found: Can't resolve '@/lib/db-connection'"
**Solución**: Los archivos SQL fueron eliminados. Ahora usa Amplify.
```typescript
import { amplifyClient } from '@/lib/amplify-config';
```

### "Amplify not initializing"
**Solución**: Asegurate de:
1. Ejecutar `npx ampx sandbox`
2. Variables de entorno configuradas
3. AWS CLI configurado

### "Port 3000 already in use"
**Solución**:
```bash
pnpm run dev -- -p 3001  # Usar puerto diferente
```

---

**Última actualización**: Enero 9, 2025
