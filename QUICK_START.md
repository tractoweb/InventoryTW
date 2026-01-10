# ⚡ QUICK START GUIDE - Comienza en 5 Minutos

## 🚀 Antes de Comenzar

```bash
# 1. Verificar Node.js versión (debe ser 18+)
node --version

# 2. Verificar pnpm
pnpm --version

# Si no tienes pnpm:
npm install -g pnpm
```

---

## 📥 Instalación Rápida

```bash
# 1. Ir a la carpeta del proyecto (ya estás aquí)
cd InventoryTW-main

# 2. Instalar dependencias
pnpm install

# 3. Configurar Amplify (en otra terminal)
npx ampx sandbox

# 4. En la primera terminal, crear .env.local
echo "JWT_SECRET=tu_clave_secreta_muy_larga_aqui" >> .env.local

# 5. Iniciar desarrollo
pnpm run dev

# 6. Abrir navegador
# http://localhost:3000
```

**Tiempo total**: 5-10 minutos

---

## 📖 Documentación (Orden Recomendado)

### Si tienes 15 minutos
```
1. Lee RESUMEN_EJECUTIVO.md
→ Entiende qué es el proyecto
```

### Si tienes 1 hora
```
1. Lee README_PROYECTO.md (15 min)
2. Lee ANALISIS_COMPLETO.md (40 min)
3. Abre src/services/ - revisa los servicios (5 min)
```

### Si tienes 2 horas (Recomendado)
```
1. Lee README_PROYECTO.md (15 min)
2. Lee ANALISIS_COMPLETO.md (40 min)
3. Lee PROXIMOS_PASOS.md (30 min)
4. Lee PLAN_MODULOS.md (25 min)
5. Explora los servicios en src/services/ (10 min)
```

### Si tienes 3-4 horas (Óptimo)
```
- Lee TODO (ver INDICE_DOCUMENTACION.md)
- Antes de escribir cualquier código
```

---

## 🎯 Tu Primera Tarea (HOY)

### Tarea: Implementar Bcrypt

**Tiempo estimado**: 30 minutos  
**Importancia**: 🔴 CRÍTICA  
**Archivo**: Ver `PROXIMOS_PASOS.md` → Tarea 1.1

```bash
# 1. Instalar bcrypt
pnpm add bcrypt
pnpm add -D @types/bcrypt

# 2. Editar src/services/auth-service.ts
# Seguir instrucciones en PROXIMOS_PASOS.md (Tarea 1.1)

# 3. Testar que funcione
pnpm run dev
# Ir a http://localhost:3000 (si tienes login)
```

---

## 🗂️ Estructura de Carpetas (Lo Importante)

```
InventoryTW-main/
│
├── 📖 Documentación (LEE ESTOS PRIMERO)
│   ├── README_PROYECTO.md
│   ├── RESUMEN_EJECUTIVO.md
│   ├── ANALISIS_COMPLETO.md
│   ├── PLAN_MODULOS.md
│   ├── PROXIMOS_PASOS.md ← SIGUE ESTE MIENTRAS TRABAJAS
│   ├── RECOMENDACIONES.md
│   ├── COMPARATIVA_TECNICA.md
│   └── INDICE_DOCUMENTACION.md
│
├── 🔧 Backend (YA IMPLEMENTADO)
│   ├── amplify/
│   │   └── data/resource.ts (30 modelos + 5 nuevos)
│   └── src/
│       ├── services/
│       │   ├── amplify-config.ts ✅
│       │   ├── auth-service.ts ✅
│       │   ├── document-service.ts ✅
│       │   ├── kardex-service.ts ✅
│       │   └── inventory-service.ts ✅
│       └── lib/
│           ├── data/ (JSON con 1000+ productos)
│           └── amplify-config.ts ✅
│
├── 🎨 Frontend (POR HACER)
│   └── src/
│       ├── app/
│       │   ├── login/ (HACER PRIMERO)
│       │   ├── dashboard/ (DESPUÉS)
│       │   └── ...otros módulos
│       └── components/
│           ├── auth/ (HACER PRIMERO)
│           ├── layout/
│           └── ...otros componentes
│
└── ⚙️ Config (HECHO)
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── tailwind.config.ts
    └── .env.local (CREAR TÚ)
```

**Lo importante**: Backend está LISTO. Solo necesitas UI.

---

## 🎓 Cómo Usar los Servicios (Ejemplos)

### Usar Auth Service
```typescript
import { authenticateUser } from '@/services/auth-service';

// En un server action o API route:
const result = await authenticateUser(email, password);

if (result.success) {
  console.log('Usuario:', result.user);
  console.log('Token:', result.sessionToken);
}
```

### Usar Inventory Service
```typescript
import { searchProducts } from '@/services/inventory-service';

// Buscar productos
const { success, products } = await searchProducts('RODAMIENTO');

if (success) {
  products.forEach(p => console.log(p.name, p.price));
}
```

### Usar Document Service
```typescript
import { generateDocumentNumber, createDocument } from '@/services/document-service';

// Generar número
const { number } = await generateDocumentNumber(documentTypeId, warehouseId);
console.log('Número documento:', number); // 2025-100-000001

// Crear documento
const { documentId } = await createDocument({
  userId: 'user123',
  documentTypeId: 'type456',
  warehouseId: 'warehouse789',
  date: new Date(),
  items: [{ productId: '123', quantity: 5, price: 100 }],
});
```

### Usar Kardex Service
```typescript
import { getProductKardexHistory } from '@/services/kardex-service';

// Historial de un producto
const { entries } = await getProductKardexHistory('productId123');

entries.forEach(e => {
  console.log(`${e.date}: ${e.type} x${e.quantity} → Balance: ${e.balance}`);
});
```

---

## 🐛 Si Algo No Funciona

### "pnpm command not found"
```bash
npm install -g pnpm
pnpm --version
```

### "Port 3000 already in use"
```bash
pnpm run dev -- -p 3001  # Usa puerto 3001
```

### "Module not found"
```bash
# Reinstala dependencias
rm pnpm-lock.yaml
pnpm install
```

### "Amplify not initializing"
```bash
# Asegúrate de ejecutar en otra terminal:
npx ampx sandbox

# Mantén esa terminal abierta mientras desarrollas
```

### "Can't find bcrypt"
```bash
pnpm remove bcrypt
pnpm add bcrypt @types/bcrypt
```

---

## ✅ Checklist de Configuración

- [ ] Node.js 18+ instalado
- [ ] pnpm instalado
- [ ] Repositorio clonado
- [ ] `pnpm install` ejecutado
- [ ] `npx ampx sandbox` en terminal separada
- [ ] `.env.local` creado con JWT_SECRET
- [ ] `pnpm run dev` ejecutándose en http://localhost:3000

---

## 🚀 Siguiente Paso Después de Setup

1. **Lee PROXIMOS_PASOS.md**
2. **Sigue Tarea 1.1: Implementar Bcrypt**
3. **Después: Implementar JWT (Tarea 1.2)**
4. **Después: Migración de datos (Tarea 2.1)**

---

## 📊 Timeline

```
HOY (30 min):
- Instalar todo
- Implementar bcrypt

MAÑANA (4-5 horas):
- Implementar JWT
- Crear script de migración
- Migrar datos

PASADO MAÑANA (4-5 horas):
- Crear login page
- Crear SessionProvider
- Hacer ProtectedRoute

SIGUIENTE SEMANA:
- Dashboard básico
- CRUD de productos
- Módulo de documentos
```

---

## 💡 Tips Importantes

### 1. Lee la Documentación PRIMERO
- No empieces a codear sin leer PROXIMOS_PASOS.md
- 30 minutos leyendo te ahorran 3 horas debuggeando

### 2. Sigue el Orden
- Bcrypt → JWT → Migración → Login → Dashboard
- No hagas cosas en otro orden

### 3. Usa los Servicios
- No reimplantes lógica ya hecha
- Los servicios en `src/services/` son tu amigo

### 4. Mantén amplify sandbox Abierto
- Una terminal con `npx ampx sandbox`
- Otra terminal con `pnpm run dev`
- No cierres la de Amplify

### 5. Valida Frecuentemente
- Después de cada cambio importante, verifica
- Usa los checklists en PROXIMOS_PASOS.md

---

## 🎓 Recursos Rápidos

| Necesidad | Archivo | Tiempo |
|-----------|---------|--------|
| Entender el proyecto | RESUMEN_EJECUTIVO.md | 15 min |
| Cómo implementar X | PROXIMOS_PASOS.md | 10-30 min |
| Todas las tareas | PLAN_MODULOS.md | 40 min |
| Mejorar calidad | RECOMENDACIONES.md | 40 min |
| Navegar docs | INDICE_DOCUMENTACION.md | 10 min |

---

## 🎯 Objetivo Final

En 1-2 semanas (siguiendo el plan):
- ✅ Backend seguro (bcrypt + JWT)
- ✅ Datos en Amplify (migrados)
- ✅ Login funcional
- ✅ Dashboard básico
- ✅ Sistema completo básico listo

En 4-6 semanas:
- ✅ Todos los módulos implementados
- ✅ Sistema completo funcional
- ✅ Listo para producción

---

**¡Buena suerte! 🚀**

Pregunta principal: ¿Completaste el setup? Si no:
1. Haz `pnpm install`
2. Abre terminal 2 con `npx ampx sandbox`
3. Abre terminal 1 con `pnpm run dev`
4. Verifica http://localhost:3000 (debería abrir)

Si todo funciona → Comienza a leer PROXIMOS_PASOS.md

