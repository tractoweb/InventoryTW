# ANÁLISIS COMPLETO - PROYECTO INVENTORYTW

## 📊 ESTADO ACTUAL DEL PROYECTO

### Arquitectura Base
- **Stack**: Next.js 14.2.35 + AWS Amplify (NoSQL)
- **Base de Datos**: DynamoDB a través de Amplify Data
- **UI Framework**: Tailwind CSS + Radix UI
- **Autenticación**: Amplify Auth (actualmente con API Key pública)
- **Estado de Datos**: JSON files en `/src/lib/data/` listos para migrar

### Estructura Actual Amplify
El schema define 30 modelos con relaciones entre:
- **Usuarios**: User (con accessLevel: 0=Cashier, 1=Admin, 9=Master)
- **Inventario**: Product, Barcode, Stock, StockControl, ProductGroup
- **Documentos**: Document, DocumentItem, DocumentType, DocumentCategory
- **Transacciones**: Payment, PaymentType, PosOrder, PosOrderItem
- **Configuración**: Tax, Template, ApplicationProperty, Counter, ZReport
- **Clientes**: Customer, CustomerDiscount, LoyaltyCard
- **Nuevo**: Kardex (ya definido en schema para auditoría de inventario)

---

## 🔴 PROBLEMAS IDENTIFICADOS

1. **Autenticación débil**: Solo usa apiKey pública (sin seguridad)
2. **Falta módulo Kardex funcional**: Definido pero sin lógica de operación
3. **Sin migración de datos**: Los JSON están listos pero no tienen código para subirlos
4. **Módulos faltantes**:
   - ❌ Módulo de login/sesión
   - ❌ Módulo de gestión de usuarios
   - ❌ Módulo de configuración de aplicación
   - ❌ Módulo de ingreso de productos
   - ❌ Módulo de ingreso de documentos
   - ❌ Módulo de salida de productos
   - ❌ Kardex con historial completo de movimientos

5. **Falta integración**: Las acciones en `/src/actions/` importan `db-connection` (SQL) que no existe

---

## 📋 ESTRUCTURA DE DATOS (NoSQL)

### Modelos Críticos para Kardex

```
Kardex
├── productId (FK → Product)
├── date (datetime - fecha movimiento)
├── documentId (FK → Document)
├── documentNumber (ej: "23-100-000001")
├── type (ENTRADA | SALIDA | AJUSTE)
├── quantity (cantidad movida)
├── balance (stock resultante)
├── unitCost (costo unitario)
├── totalCost (cantidad × costo)
├── userId (quién hizo el movimiento)
└── note (razón del movimiento)
```

### Flujo de Documentos → Kardex
```
Document + DocumentType(stockDirection) 
    ↓
Crea DocumentItems
    ↓
Actualiza Stock
    ↓
Registra Kardex entry
```

---

## 🔑 DATOS EXISTENTES (JSON a Migrar)

| Tabla | Registros | Estado |
|-------|-----------|--------|
| User.json | 1 | Listo (admin: tractoagricola@gmail.com) |
| Product.json | 1000+ | Listo (con códigos/barcodes) |
| Company.json | 1 | Listo |
| Stock.json | +1000 | Listo (inventario actual) |
| Document.json | 100+ | Listo (historial de movimientos) |
| Tax.json | Varios | Listo (IVA: 19%) |
| Warehouse.json | 1 | Listo |
| Customer.json | +100 | Listo (proveedores/clientes) |
| ProductGroup.json | 20+ | Listo (categorías) |

---

## ✅ PLAN DE IMPLEMENTACIÓN

### FASE 1: Corregir Estructura
1. Eliminar imports de SQL (`db-connection`)
2. Actualizar Amplify schema con modelos faltantes:
   - `SessionConfig` (datos de sesión actual)
   - `ApplicationSettings` (configuración general)
3. Crear capa de servicios Amplify

### FASE 2: Migración de Datos
1. Script de migración (`migrate-data-amplify.ts`)
2. Subir datos secuencialmente (respetando FK)
3. Crear Kardex inicial desde Stock y Document

### FASE 3: Autenticación y Sesión
1. Implementar módulo de **Login**
   - Validar contra tabla User
   - Generar JWT/sesión
   - Guardar accessLevel
2. Módulo de **Gestión de Sesión**
   - Provider para estado global
   - Protección de rutas

### FASE 4: Módulos Principales
1. **Gestión de Usuarios**
   - CRUD de usuarios
   - Control de acceso por accessLevel
2. **Configuración de Aplicación**
   - Propiedades globales
   - Templates de documentos
3. **Ingreso de Productos**
   - ABM de productos
   - Códigos y barcodes
4. **Ingreso de Documentos**
   - ABM de documentos de compra
   - Generación automática de números
   - Creación automática de Kardex entries
5. **Salida de Productos** (Devoluciones/Ajustes)
   - Crear documentos de salida
   - Reflejar en Kardex

### FASE 5: Kardex Avanzado
1. Historial completo de movimientos
2. Trazabilidad de entrada/salida
3. Reportes por producto
4. Auditoría de cambios

---

## 📁 ESTRUCTURA RECOMENDADA ADICIONAL

```
src/
├── actions/
│   ├── auth/
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   └── validate-session.ts
│   ├── users/
│   │   ├── create-user.ts
│   │   ├── update-user.ts
│   │   └── delete-user.ts
│   ├── products/
│   │   ├── create-product.ts
│   │   ├── update-product.ts
│   │   └── import-products.ts
│   ├── documents/
│   │   ├── create-document.ts
│   │   ├── finalize-document.ts
│   │   └── generate-number.ts
│   ├── kardex/
│   │   ├── get-kardex-entries.ts
│   │   ├── create-kardex-entry.ts
│   │   └── get-product-history.ts
│   └── config/
│       ├── get-settings.ts
│       └── update-settings.ts
│
├── services/
│   ├── amplify-client.ts (cliente con API key)
│   ├── auth-service.ts
│   ├── document-service.ts
│   ├── kardex-service.ts
│   └── inventory-service.ts
│
├── components/
│   ├── auth/
│   │   ├── login-form.tsx
│   │   └── session-provider.tsx
│   ├── users/
│   │   ├── user-form.tsx
│   │   └── users-list.tsx
│   ├── products/
│   │   ├── product-form.tsx
│   │   └── product-import.tsx
│   ├── documents/
│   │   ├── document-form.tsx
│   │   └── document-list.tsx
│   └── kardex/
│       ├── kardex-table.tsx
│       └── product-history.tsx
│
├── app/
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── users/
│   │   └── page.tsx
│   ├── products/
│   │   └── page.tsx
│   ├── documents/
│   │   └── page.tsx
│   ├── kardex/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
│
└── lib/
    ├── amplify-config.ts
    ├── auth-context.ts
    ├── constants.ts (tipos, enums)
    └── utils.ts
```

---

## 🚀 PASOS INMEDIATOS

### 1. Actualizar Amplify Schema
- Agregar `SessionConfig`
- Agregar `ApplicationSettings`
- Mejorar permisos de autorización

### 2. Crear Servicios Amplify
```typescript
// Ejemplo de patrón a usar
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@/amplify/resources';

const client = generateClient<Schema>();
```

### 3. Crear Script de Migración
- Leer JSON desde `/src/lib/data/`
- Insertar en orden correcto (tablas sin FK primero)
- Crear Kardex inicial desde Stock existente

### 4. Implementar Autenticación
- Session Provider en root layout
- Protected routes middleware
- Validación de accessLevel

---

## 💡 RECOMENDACIONES ADICIONALES

### Seguridad
1. **Cambiar API Key por IAM o Cognito** para producción
2. **Implementar validación de accessLevel** en cada acción
3. **Auditoría**: Registrar usuario + timestamp en cada cambio Kardex

### UX/Features
1. **Código de barras**: Agregar scanner de códigos QR/barras
2. **Alertas de Stock Bajo**: Dashboard widget basado en `StockControl.lowStockWarningQuantity`
3. **Reportes**:
   - Movimiento por producto (Kardex)
   - Rotación de inventario
   - Proyección de stock
4. **Búsqueda avanzada**: Por código, nombre, barcode
5. **Sinc offline**: LocalStorage + sincronización cuando vuelva conexión

### Performance
1. **Paginación**: Implementar en tablas grandes
2. **Caché**: React Query o SWR para queries frecuentes
3. **Optimización de imágenes**: Usar `next/image`

### Datos Transaccionales
1. **Números de documento automáticos**: Usar tabla `Counter`
2. **Transacciones Kardex**: Crear entry cuando se finaliza documento (trigger lógico)
3. **Descuentos**: Gestionar en DocumentItem antes de finalizar

---

## ⚠️ CONSIDERACIONES CRÍTICAS

1. **Balance en Kardex**: Debe recalcularse después de cada movimiento
2. **Documentos finalizados**: No permitir editar después de cierre
3. **Stock negativo**: Validar si es permitido por tipo de documento
4. **Costo unitario en Kardex**: Importante para valuación de inventario

