# PRÓXIMOS PASOS - ACTIONABLE CHECKLIST

## 🎯 FASE 1: SEGURIDAD CRÍTICA (1-2 días)

### Tarea 1.1: Implementar Bcrypt
**Archivo**: `src/services/auth-service.ts`

```bash
# 1. Instalar paquetes
pnpm add bcrypt
pnpm add -D @types/bcrypt

# 2. Actualizar auth-service.ts
# Reemplazar esta sección:

-// En producción: usar bcrypt o similar para validar hash
-// Por ahora comparación simple (TODO: implementar hash)
-if (user.password !== password) {

+import bcrypt from 'bcrypt';
+
+// Validar password con bcrypt
+const passwordValid = await bcrypt.compare(password, user.password);
+if (!passwordValid) {

# 3. En createUser (nuevo):
+const hashedPassword = await bcrypt.hash(password, 10);
```

**Test**: Verificar que login todavía funciona con la contraseña hash

---

### Tarea 1.2: Implementar JWT
**Archivo**: `src/services/auth-service.ts`

```bash
# 1. Instalar paquetes
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken

# 2. Reemplazar generateSessionToken()
-function generateSessionToken(userId: string): string {
-  const timestamp = Date.now();
-  const random = Math.random().toString(36).substring(2, 15);
-  return `${userId}-${timestamp}-${random}`;
-}

+import jwt from 'jsonwebtoken';
+
+function generateSessionToken(userId: string): string {
+  return jwt.sign(
+    { userId, iat: Math.floor(Date.now() / 1000) },
+    process.env.JWT_SECRET!,
+    { expiresIn: '8h' }
+  );
+}

# 3. Crear middleware de validación
# Crear: src/lib/verify-token.ts
export function verifyToken(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return null;
  }
}
```

**Variables de entorno**: Agregar a `.env.local`
```env
JWT_SECRET=generate-a-very-long-random-string-here-at-least-32-chars
JWT_EXPIRATION=8h
```

**Generar JWT_SECRET** (en terminal):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Test**: Token debe expirar en 8 horas

---

## 🗄️ FASE 2: MIGRACIÓN DE DATOS (2-3 días)

### Tarea 2.1: Crear Script de Migración
**Archivo a crear**: `src/lib/migrate-amplify.ts`

```typescript
// Plantilla básica
import { amplifyClient } from '@/lib/amplify-config';
import * as fs from 'fs';
import * as path from 'path';

const dataPath = path.join(process.cwd(), 'src/lib/data');

// Tabla de orden de inserción (respetando FK)
const insertionOrder = [
  'Country',
  'Currency',
  'Warehouse',
  'Company',
  'Tax',
  'PaymentType',
  'DocumentCategory',
  'ProductGroup',
  'Product',
  'Barcode',
  'ProductTax',
  'Customer',
  'CustomerDiscount',
  'LoyaltyCard',
  'StockControl',
  'Stock',
  'User',
  'DocumentType',
  'Document',
  'DocumentItem',
  'DocumentItemTax',
  'Payment',
  'PosOrder',
  'StartingCash',
  'ZReport',
  'Counter',
  'Template',
  'ApplicationProperty',
];

async function migrateData() {
  console.log('🚀 Iniciando migración a Amplify...');

  for (const tableName of insertionOrder) {
    const filePath = path.join(dataPath, `${tableName}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Archivo no encontrado: ${tableName}.json`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`📦 Migrando ${tableName}... (${data.length} registros)`);

    for (const record of data) {
      try {
        // Mapear campos de SQL a Amplify (camelCase)
        const mapped = mapRecord(tableName, record);
        
        // Crear en Amplify
        const model = (amplifyClient.models as any)[tableName];
        await model.create(mapped);
      } catch (error) {
        console.error(`❌ Error en ${tableName}:`, error);
      }
    }

    console.log(`✅ ${tableName} completado`);
  }

  console.log('🎉 Migración completada');
}

function mapRecord(tableName: string, record: any): any {
  // Convertir nombres de campos de SQL (PascalCase) a JS (camelCase)
  const mapped: any = {};
  
  for (const [key, value] of Object.entries(record)) {
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
    mapped[camelKey] = value;
  }

  // Mapeos especiales
  switch (tableName) {
    case 'User':
      return {
        username: mapped.username || 'unknown',
        password: mapped.password,
        email: mapped.email,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        accessLevel: mapped.accessLevel || 0,
        isEnabled: mapped.isEnabled !== 0,
      };
    // ... más mapeos específicos
  }

  return mapped;
}

// Ejecutar
migrateData().catch(console.error);
```

**Agregar a package.json**:
```json
{
  "scripts": {
    "migrate:amplify": "tsx src/lib/migrate-amplify.ts"
  }
}
```

**Ejecutar**:
```bash
pnpm migrate:amplify
```

---

### Tarea 2.2: Validar Migración
```bash
# Verificar que los datos estén en Amplify
# En consola de AWS o usando Amplify Studio

# Validar:
- [ ] 1000+ Products
- [ ] 100+ Documents
- [ ] Usuarios
- [ ] Taxes, Warehouses, etc.
```

---

## 🔐 FASE 3: AUTENTICACIÓN (1-2 días)

### Tarea 3.1: Crear Login Page
**Archivo a crear**: `src/app/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authenticateUser } from '@/services/auth-service';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await authenticateUser(email, password);

    if (result.success) {
      // Guardar token en cookie o localStorage
      localStorage.setItem('sessionToken', result.sessionToken || '');
      
      toast({
        title: 'Login Exitoso',
        description: `Bienvenido ${result.user?.firstName}`,
        variant: 'success',
      });

      router.push('/dashboard');
    } else {
      toast({
        title: 'Error de Login',
        description: result.error,
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Login</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tractoagricola@gmail.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Contraseña</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

---

### Tarea 3.2: Crear Session Provider
**Archivo a crear**: `src/components/auth/session-provider.tsx`

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { validateSession } from '@/services/auth-service';

interface SessionContextType {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    accessLevel: number;
  };
  loading: boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<SessionContextType['user']>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('sessionToken');
      const userId = localStorage.getItem('userId');

      if (token && userId) {
        const { valid, session } = await validateSession(userId, token);
        if (valid && session) {
          setIsAuthenticated(true);
          setUser({
            id: session.userId,
            email: session.email || '',
            accessLevel: session.accessLevel,
          });
        } else {
          localStorage.clear();
        }
      }

      setLoading(false);
    };

    checkSession();
  }, []);

  const logout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setUser(undefined);
  };

  return (
    <SessionContext.Provider value={{ isAuthenticated, user, loading, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return context;
}
```

**Agregar a layout.tsx**:
```typescript
import { SessionProvider } from '@/components/auth/session-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

### Tarea 3.3: Crear Protected Route
**Archivo a crear**: `src/components/auth/protected-route.tsx`

```typescript
'use client';

import { useSession } from './session-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function ProtectedRoute({ 
  children, 
  requiredLevel = 0 
}: { 
  children: React.ReactNode;
  requiredLevel?: number;
}) {
  const { isAuthenticated, user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <Skeleton className="w-full h-screen" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user && user.accessLevel < requiredLevel) {
    return <div className="p-4">No tienes permisos para acceder aquí</div>;
  }

  return <>{children}</>;
}
```

---

## 🎨 FASE 4: DASHBOARD BÁSICO (1-2 días)

### Tarea 4.1: Crear Dashboard Page
**Archivo a crear**: `src/app/dashboard/page.tsx`

```typescript
'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { useSession } from '@/components/auth/session-provider';
import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  const { user } = useSession();

  return (
    <ProtectedRoute>
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">
          Bienvenido, {user?.email}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Productos</h3>
            <p className="text-3xl font-bold">1,243</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Stock Bajo</h3>
            <p className="text-3xl font-bold text-red-600">42</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Documentos Hoy</h3>
            <p className="text-3xl font-bold">12</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Valor Inventario</h3>
            <p className="text-3xl font-bold">$2.5M</p>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
```

---

## ✅ CHECKLIST DE VALIDACIÓN

### Después de completar Fase 1 (Seguridad)
- [ ] bcrypt instalado y funcionando
- [ ] JWT generándose correctamente
- [ ] Passwords hasheados en BD
- [ ] Tokens expiran en 8 horas

### Después de completar Fase 2 (Migración)
- [ ] Script migrate-amplify.ts funciona
- [ ] 1000+ productos en BD
- [ ] 100+ documentos en BD
- [ ] Todos los datos vinculados correctamente

### Después de completar Fase 3 (Auth)
- [ ] Login page accesible en `/login`
- [ ] Puede ingresar con email/password
- [ ] Redirecciona a dashboard
- [ ] SessionProvider funciona
- [ ] Protected routes redirige a login si no autenticado

### Después de completar Fase 4 (Dashboard)
- [ ] Dashboard page en `/dashboard`
- [ ] Muestra información del usuario
- [ ] Widgets básicos visibles
- [ ] Accesible solo para usuarios autenticados

---

## 🐛 DEBUGGING

### Si el login no funciona
```bash
# Verificar usuario en BD
# En Amplify Studio o AWS Console:
# - Table: User
# - Filter: email = tractoagricola@gmail.com

# Verificar logs
pnpm run dev  # Ver output en console
```

### Si bcrypt da error
```bash
# Verificar instalación
pnpm list bcrypt

# Reinstalar si es necesario
pnpm remove bcrypt
pnpm add bcrypt
```

### Si JWT da error
```bash
# Verificar JWT_SECRET en .env.local
cat .env.local | grep JWT_SECRET

# Generar nueva key si es necesario
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📞 SOPORTE RÁPIDO

| Problema | Solución |
|----------|----------|
| "Module not found" | Ejecutar `pnpm install` |
| "Cannot find jwt" | Ejecutar `pnpm add jsonwebtoken @types/jsonwebtoken` |
| "User not found" | Migrar datos primero |
| "Port 3000 in use" | `pnpm run dev -- -p 3001` |

---

## 🎯 ESTIMACIÓN DE TIEMPO

| Fase | Duración | Status |
|------|----------|--------|
| 1. Seguridad | 1-2 días | 🟡 No iniciado |
| 2. Migración | 2-3 días | 🟡 No iniciado |
| 3. Autenticación | 1-2 días | 🟡 No iniciado |
| 4. Dashboard | 1-2 días | 🟡 No iniciado |
| **TOTAL** | **5-9 días** | 🟡 No iniciado |

---

**Siguiente paso**: Comienza con Tarea 1.1 (Bcrypt)

