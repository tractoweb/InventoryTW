# Estrategia de Eliminación Total & Gestión de Duplicados - Análisis Profundo

**Referencia:** PLAN_COMPLETO_GESTION_PRODUCTOS.md (Sección 8)  
**Fecha:** Junio 10, 2026

---

## 📊 Análisis: ¿Por Qué NO Hacer Hard Delete?

### Escenario Real 1: Auditoría Fiscal

**Situación:**
```
2026-01-15: Usuario crea Producto "HERRAMIENTA X" (ID=5000)
2026-01-15: Usuario lo deshabilitá 5 minutos después (accidental)
2026-06-10: Auditor fiscal pregunta: "¿Qué productos se crearon en enero?"
```

**Con SOFT DELETE (Actual):**
```sql
SELECT * FROM Product WHERE createdAt BETWEEN '2026-01-01' AND '2026-01-31'
AND isEnabled = false AND disabledReason = 'Accidental'

Resultado:
- ID: 5000
- Name: HERRAMIENTA X
- CreatedAt: 2026-01-15
- DisabledAt: 2026-01-15
- DisabledReason: Accidental
- DisabledBy: userId=10

Auditor: ✅ "Veo que se creó y deshabilitó. Archivo la documentación."
```

**Con HARD DELETE:**
```
SELECT * FROM Product WHERE id = 5000
Resultado: Nada (0 registros)

SELECT * FROM AuditLog WHERE recordId = 5000 AND tableName = 'Product'
Resultado: Nada (si el hard delete limpió el audit)

Auditor: ❌ "No hay rastro. ¿Existió realmente? Requiero investigación."
```

---

### Escenario Real 2: Documentos Huérfanos

**Situación:**
```
2026-02-20: Se vende Producto P001 en Documento D-0001
2026-06-01: Alguien borra el Producto P001 (hard delete)
2026-06-10: Cliente llama: "Necesito duplicado de factura D-0001"
```

**Tabla DocumentItem (ANTES):**
```
documentId | productId | quantity | price | total
-----------|-----------|----------|-------|-------
D-0001     | P001      | 10       | $50   | $500
```

**Con SOFT DELETE:**
```
1. Hard delete NO ocurre
2. SELECT * FROM Product WHERE idProduct = P001 AND isEnabled = false
   └─ Retorna: {name: "Producto Orig", disabledReason: "Accidental"}
3. Puedo generar factura: "Se vendieron 10 unidades de Producto Orig a $50 c/u"
4. Cliente satisfecho ✅
```

**Con HARD DELETE:**
```
1. Hard delete se ejecuta
   └─ DELETE FROM Product WHERE idProduct = P001
   └─ DELETE FROM Barcode WHERE productId = P001
   └─ DELETE FROM Stock WHERE productId = P001
   
2. SELECT * FROM Product WHERE idProduct = P001
   └─ NULL / No resultado
   
3. Intento generar factura:
   └─ Query: SELECT Document, DocumentItem.product FROM DocumentItem
   └─ Resultado: {documentId: D-0001, productId: 1, product: NULL}
   
4. Salida de factura:
   ```
   FACTURA D-0001
   Producto: [vacío]
   Cantidad: 10 unidades de NADA
   Precio: $50 cada una
   Total: $500
   ```
5. Cliente confundido: ❌ "¿Qué me vendieron?"
```

---

### Escenario Real 3: Kardex Integridad

**Situación:**
```
Producto P001 tiene estos movimientos:
2026-01-01: Compra 100 unidades
2026-02-15: Venta 30 unidades
2026-03-20: Ajuste -10 unidades
2026-04-10: Venta 40 unidades
(Saldo final: 20 unidades)

El usuario decide: "Borra este producto, fue error"
```

**Con SOFT DELETE:**
```
1. Product.isEnabled = false (otros campos igual)
2. Kardex sigue intacto (50 registros de movimientos)
3. Puedo ejecutar: SELECT * FROM Kardex WHERE productId = P001
   └─ Retorna: Todo el historial de movimientos
4. Reporte "Historial de Stock P001":
   ├─ 2026-01-01: +100 (Compra) = 100
   ├─ 2026-02-15: -30 (Venta) = 70
   ├─ 2026-03-20: -10 (Ajuste) = 60
   ├─ 2026-04-10: -40 (Venta) = 20
   └─ Final: 20 unidades
5. Auditor: ✅ "Todo claro. El producto existió y se movió así."
```

**Con HARD DELETE:**
```
1. DELETE FROM Product WHERE idProduct = P001
2. DELETE FROM Kardex WHERE productId = P001  (¡¡¡se pierden 50 registros!!!)
3. SELECT * FROM Kardex WHERE productId = P001
   └─ Retorna: Nada (0 registros)
4. Reporte "Historial de Stock P001":
   └─ No hay datos
5. Auditor: ❌ "¿Cuál es el historial de stock?"
   └─ Respuesta: "Se borró."
   └─ Auditor: "¿Por qué se borraron datos?"
   └─ Tú: "El usuario lo pidió."
   └─ Auditor: ❌ ❌ ❌ "Violación de auditoría. Multa."
```

---

### Escenario Real 4: Duplicados Anidados

**Situación:**
```
Tienes 5 productos que son duplicados:
- P001 (HERRAMIENTA A) - PRIMARIO
- P002 (TOOL A) - Duplicado de P001, mergeado
- P003 (HERRAMIENTA A 2) - Duplicado de P001, mergeado
- P004 (Tool_A) - Duplicado de P001, mergeado
- P005 (HERRAMIENTA A NUEVA) - Duplicado de P001, mergeado

Después de los merges:
- P001.mergedIntoProductId = NULL (es primario)
- P002.mergedIntoProductId = 1
- P003.mergedIntoProductId = 1
- P004.mergedIntoProductId = 1
- P005.mergedIntoProductId = 1

Usuario intenta: "Borra todos los duplicados"
```

**Con SOFT DELETE:**
```
Query: SELECT * FROM Product WHERE mergedIntoProductId = 1

Resultado:
- P002 ✓ (isEnabled=false, mergedIntoProductId=1)
- P003 ✓ (isEnabled=false, mergedIntoProductId=1)
- P004 ✓ (isEnabled=false, mergedIntoProductId=1)
- P005 ✓ (isEnabled=false, mergedIntoProductId=1)

Encuentro: ✅ "Hay 4 duplicados que se han merged en P001"
Puedo: Auditar qué pasó, cuándo, por qué
```

**Con HARD DELETE:**
```
Usuario ejecuta:
  DELETE FROM Product WHERE mergedIntoProductId = 1

Inmediatamente después:
  DELETE FROM Product WHERE idProduct IN (2, 3, 4, 5)
  DELETE FROM AuditLog WHERE recordId IN (2, 3, 4, 5) AND tableName='Product'

Query: SELECT * FROM Product WHERE mergedIntoProductId = 1
Resultado: Nada (todos fueron borrados)

Después de 2 semanas, usuario pregunta:
  "¿Cuántos productos fueron merged en P001?"
  Respuesta: "No hay forma de saberlo. Se borraron."

Cliente reclama: ❌ "Perdieron nuestro historial de consolidación"
```

---

## 🔄 Caso de Uso: Ciclo de Vida de Producto

### Flujo Completo (Con Soft Delete)

```
PASO 1: CREACIÓN
└─ Usuario crea Producto "TORNILLO M8"
   ├─ Product.idProduct = 1000
   ├─ Product.isEnabled = TRUE
   ├─ Product.disabledReason = NULL
   └─ AuditLog: "CREATED"

PASO 2: DUPLICADO ACCIDENTAL
└─ Usuario crea "TORNILLO M8" NUEVAMENTE (error)
   ├─ Product.idProduct = 1001
   ├─ Product.isEnabled = TRUE
   ├─ Automáticamente: System detecta EXACT_NAME match (0.99 confidence)
   ├─ ProductDuplicateCandidate creado (status=PENDING)
   └─ AuditLog: "CREATED", relatedRecords: ["1000"]

PASO 3: DESHABILITACIÓN ACCIDENTAL
└─ Usuario ve el segundo producto y lo deshabilitá
   ├─ Product[1001].isEnabled = FALSE
   ├─ Product[1001].disabledReason = "Accidental"
   ├─ Product[1001].disabledAt = "2026-06-10 10:30:00"
   ├─ DisabledEntityHistory creado
   └─ AuditLog: "UPDATED", reason: "User disabled"

PASO 4: DETECCIÓN AUTOMÁTICA
└─ Sistema ejecuta detectDuplicate()
   ├─ Encuentra P1001 (disabled) y P1000 (enabled)
   ├─ Crea ProductDuplicateCandidate (primario=1000, duplicate=1001)
   ├─ Confidence = 0.99 (EXACT_NAME)
   ├─ Status = "PENDING"
   └─ Notificación: "Duplicado detectado"

PASO 5: REVISIÓN MANUAL
└─ Usuario abre "Gestión de Duplicados"
   ├─ Ve: 1000 vs 1001 (Confianza 99%)
   ├─ Confirma: "Sí, son lo mismo"
   ├─ ProductDuplicateCandidate.status = "CONFIRMED"
   └─ Botón disponible: [Fusionar Ahora]

PASO 6: FUSIÓN
└─ Usuario ejecuta mergeProducts(primary=1000, duplicate=1001)
   ├─ Validación: ¿Hay documentos con P1001? Sí, 5 documentos
   ├─ Confirmación: "¿Fusionar? 5 documentos serán actualizados"
   ├─ Transacción:
   │  ├─ Barcodes: Redirigir a P1000
   │  ├─ Kardex: Todos los movimientos a P1000
   │  ├─ DocumentItem: Los 5 documentos apuntan a P1000
   │  ├─ Stocks: Consolidar almacenes
   │  └─ Product[1001]: isEnabled=FALSE, mergedIntoProductId=1000
   ├─ ProductMergeHistory creado
   ├─ AuditLog: "MERGED", impactedDocuments=5
   └─ Confirmación: "✅ Fusión exitosa. 5 documentos actualizados."

PASO 7: RESULTADO FINAL
├─ Product[1000]: isEnabled=TRUE (intacto, con más datos)
├─ Product[1001]: isEnabled=FALSE, mergedIntoProductId=1000
├─ Todo el historial: Guardado en DisabledEntityHistory + AuditLog
└─ Auditoría: 100% traceable. ✅ CUMPLIMIENTO FISCAL

PASO 8: ¿QUÉ PASA EN 2027?
└─ Auditor fiscal: "Muestren operaciones de junio 2026"
   ├─ Reporte: "Producto 1001 se creó, se deshabilitó, se fusionó"
   ├─ Detalle: Cuándo, por quién, por qué
   ├─ Documentos: 5 vendidos antes del merge
   └─ Auditor: ✅ "Todo está bien. Buen control."
```

---

## 🚫 Escenario Contrario: Si Hubieras Hecho Hard Delete

```
PASO 1-3: Igual que arriba...

PASO 4: HARD DELETE
└─ Usuario piensa: "Bórralo completamente"
   ├─ DELETE FROM Product WHERE idProduct = 1001
   ├─ DELETE FROM Barcode WHERE productId = 1001
   ├─ DELETE FROM Kardex WHERE productId = 1001
   ├─ DELETE FROM Stock WHERE productId = 1001
   ├─ DELETE FROM DocumentItem WHERE productId = 1001 ← ¡¡¡PELIGRO!!!
   ├─ DELETE FROM ProductDuplicateCandidate WHERE duplicate=1001
   ├─ DELETE FROM AuditLog WHERE recordId = 1001
   └─ Resultado: P1001 DESAPARECE COMPLETAMENTE

PASO 5: CONFLICTO CASCADA
└─ Documentos D001, D002, D003, D004, D005 tenían items con P1001
   ├─ Esos items fueron ELIMINADOS
   ├─ Facturas ahora muestran: "Cantidad: 5, Producto: [vacío]"
   └─ Cliente pregunta: "¿Qué compramos?"

PASO 6: AUDITORÍA 2027
└─ Auditor: "¿Por qué hay documentos sin productos asociados?"
   ├─ Tú: "Se eliminó el producto."
   ├─ Auditor: "¿Por qué eliminaron datos de venta?"
   ├─ Tú: "Fue error..."
   ├─ Auditor: "¿No hay audit trail?"
   ├─ Tú: "Se borró también."
   ├─ Auditor: "¿Quién ordenó borrar datos?"
   ├─ Tú: "El usuario..."
   ├─ Auditor: ❌ ❌ ❌ "INCUMPLIMIENTO. MULTA."
   └─ CEO: ¿Qué pasó? Yo: "Fue un click..."
```

---

## ✅ Estrategia Recomendada: Ciclos de Vida

### Ciclo 1: "SAFE DELETE" (Soft Delete Inmediato)

```
Cuándo usar:
- Producto recién creado (< 1 hora)
- Sin documentos asociados
- Stock = 0 en todos lados

Proceso:
1. disableProduct(productId, "Accidental")
2. Product.isEnabled = false
3. DisabledEntityHistory + AuditLog + Notificación
4. Usuario puede rehabilitar fácilmente
5. Datos 100% intactos

Riesgos: 0
Recuperabilidad: 100%
```

### Ciclo 2: "ARCHIVE DELETE" (Soft Delete + Espera)

```
Cuándo usar:
- Producto antiguo (> 1 año sin venta)
- Obsoleto
- Confirmado: no vuelven a necesitarlo

Proceso:
1. disableProduct(productId, "Obsolete")
   ├─ Reason: "No vendido en 12+ meses"
   ├─ Trigger: Auto-deshabilitación (configurable)
2. Sistema alertas: "Producto archivado. Revisar en 3 meses."
3. Después de 90 días: "¿Confirmas que sea purga permanente?"
   ├─ Usuario: "Sí"
   ├─ Sistema: ENTONCES hard delete (si fuera necesario)
   └─ AuditLog: "PURGED - Producto eliminado permanentemente"

Riesgos: Bajo (90 días de reflexión)
Recuperabilidad: 90% (tiene backup)
```

### Ciclo 3: "MERGE DELETE" (Fusión Inteligente)

```
Cuándo usar:
- Producto duplicado
- Ambos son funcionales
- Necesita consolidación

Proceso:
1. Detectar automáticamente (confidence > 90%)
2. Usuario confirma: "Sí, fusionar"
3. mergeProducts(primary=1000, duplicate=1001)
   ├─ Validación: ¿Seguro?
   ├─ Consolidar datos
   ├─ Redirigir documentos
   ├─ Marcar como merged (NO hard delete)
4. Product[1001]: mergedIntoProductId = 1000
5. Puedo DESHACER si es necesario (requiere script)

Riesgos: Bajo (es reversible con script)
Recuperabilidad: 100%
Datos Consolidados: ✅
```

### Ciclo 4: "TRUE PURGE" (Hard Delete - ÚLTIMO RECURSO)

```
Cuándo usar:
- Solo cuando legally required
- Ejemplo: GDPR - Usuario solicita "derecho al olvido"
- O: Error crítico en BD que requiere limpieza

Proceso:
1. Requerimiento legal obligatorio
2. Escalación gerencial: "¿Autoriza purga?"
3. Backup COMPLETO antes
4. Audit log: "PURGE_REQUESTED - Motivo legal: GDPR"
5. Hard delete (SOLO tras 3 confirmaciones)
6. Email audit: "Producto X fue purgado"

Riesgos: CRÍTICOS (pérdida de datos)
Recuperabilidad: Solo via backup restauración
Aprobaciones: 3 (mínimo)
```

---

## 📋 Matriz de Decisión: ¿Qué Hacer con Producto X?

```
┌─────────────────────────────────────────────────────────────────┐
│ ÁRBOL DE DECISIÓN: ¿CÓMO ELIMINAR/DESACTIVAR?                  │
└─────────────────────────────────────────────────────────────────┘

                      ¿Necesitas BORRAR Producto?
                              │
                    ┌─────────┴─────────┐
                    │                   │
            ¿Tiene documentos?      ¿Tiene documentos?
                    SI                  NO
                    │                   │
                    ▼                   ▼
            ¿Fue error reciente?   ¿Fue error?
            (< 1 hora)             (< 1 día)
                    │                   │
              ┌─────┴─────┐       ┌─────┴─────┐
              SI          NO       SI         NO
              │           │        │          │
              ▼           ▼        ▼          ▼
          SOFT      ¿Es duplicado?  SOFT   ¿Obsoleto?
          DELETE    de otro?        DELETE      │
                        │               ┌───────┴────────┐
                  ┌─────┴─────┐         SI              NO
                  SI          NO         │               │
                  │           │          ▼               ▼
                  ▼           ▼     SOFT DELETE    ¿Legalmente
              MERGE       SOFT         (Archive)   requerido?
            PRODUCTS      DELETE                      │
                        (Accidental)        ┌─────────┴────────┐
                                            SI               NO
                                            │                 │
                                            ▼                 ▼
                                        HARD DELETE       NUNCA HARD DELETE
                                    (Legal compliance)     (Solo soft delete)
                                     + 3 confirmaciones    + Audit trail
                                     + Backup completo


RESULTADO FINAL: Casi NUNCA hard delete. Solo soft delete + audit.
```

---

## 🛡️ Protecciones de Sistema

### Protección 1: Validación Pre-Merge

```typescript
async function validateMerge(primary: number, duplicate: number) {
  const checks = {
    bothExist: await checkBothProductsExist(),
    notAlreadyMerged: await checkNotAlreadyMerged(),
    priceCompatible: await checkPriceCompatible(),
    barcodeConflict: await checkBarcodeConflict(),
    documentImpact: await countImpactedDocuments(),
  };
  
  if (!checks.bothExist || !checks.notAlreadyMerged) {
    throw new Error("Merge validation failed");
  }
  
  return {
    canMerge: true,
    warnings: [
      checks.priceCompatible ? null : "Prices differ by 15%",
      checks.barcodeConflict ? "3 barcode conflicts found" : null,
    ].filter(Boolean),
    impactedDocuments: checks.documentImpact,
  };
}
```

### Protección 2: Confirmación en 3 Pasos

```typescript
// Usuario hace click [Merge]
// ↓
// PASO 1: Modal de validación
async function mergeStep1(primary, duplicate) {
  const validation = await validateMerge(primary, duplicate);
  
  if (validation.warnings.length > 0) {
    showModal({
      title: "⚠️ Advertencias",
      warnings: validation.warnings,
      buttons: ["Revisar", "Proceder"],
    });
  }
}

// Usuario hace click [Proceder]
// ↓
// PASO 2: Resumen de cambios
async function mergeStep2(primary, duplicate) {
  const summary = {
    barcodesMerged: 3,
    kardexEntries: 47,
    documentsImpacted: 23,
    stockWarehousesMerged: 2,
  };
  
  showModal({
    title: "📋 Resumen de Cambios",
    summary,
    buttons: ["Cancelar", "Confirmar Fusión"],
  });
}

// Usuario hace click [Confirmar Fusión]
// ↓
// PASO 3: Ejecutar transacción
async function mergeStep3(primary, duplicate) {
  const transaction = await executeInTransaction(async () => {
    await updateBarcodes(primary, duplicate);
    await updateKardex(primary, duplicate);
    await updateDocuments(primary, duplicate);
    await markAsMerged(duplicate, primary);
  });
  
  showNotification("✅ Fusión exitosa");
}
```

### Protección 3: Audit Trail Completo

```typescript
// Cada operación registra:
const auditEntry = {
  logId: uuid(),
  action: "MERGED",
  tableName: "Product",
  recordId: duplicateProductId,
  oldValues: JSON.stringify({
    isEnabled: true,
    mergedIntoProductId: null,
  }),
  newValues: JSON.stringify({
    isEnabled: false,
    mergedIntoProductId: primaryProductId,
  }),
  reason: "Duplicate consolidation",
  relatedRecords: JSON.stringify({
    primaryProductId,
    barcodesMerged: 3,
    documentsImpacted: ["D001", "D002", "D003"],
  }),
  impactedDocuments: 3,
  userId: getCurrentUserId(),
  timestamp: new Date(),
};

await amplifyClient.models.AuditLog.create(auditEntry);
```

---

## 📊 Métricas a Monitorear

### Semana 1 (Post-Deployment)

```
✓ Productos deshabilitados por "Accidental": < 2%
  └─ Si > 2%: Revisar UI (¿es accesible el botón?)

✓ Duplicados detectados automáticamente: > 50
  └─ Si < 50: Revisar algoritmo de detección

✓ Duplicados confirmados por usuario: > 30%
  └─ Si < 30%: Revisar confianza del algoritmo

✓ Merges ejecutados: > 10
  └─ Si < 10: Usuarios no usan feature

✓ Errores en transacciones: 0
  └─ Si > 0: Crítico - investigar inmediatamente
```

### Mes 1 (Post-Deployment)

```
✓ Productos deshabilitados totales: 5-10%
  └─ Esperado: Descubrimiento de antiguos errores

✓ Candidatos a duplicado resueltos: > 80%
  └─ Si < 80%: Hay cola de revisión

✓ Fusiones completadas: > 100
  └─ Indicador: Alta deduplicación

✓ Reactivaciones: < 5%
  └─ Si > 5%: Análisis: ¿Por qué se deshabilitó?

✓ Compliance Score: 100%
  └─ Todo auditado y traceable
```

---

## 🔐 Restricciones de Acceso (RBAC)

```typescript
// Solo Super Admin puede:
- Hacer hard delete (si legalmente requerido)
- Ver datos de todos los usuarios
- Ejecutar purge

// Gerente de Inventario puede:
- Deshabilitar productos (soft delete)
- Confirmar duplicados
- Ejecutar merges
- Ver historial completo

// Usuario Normal puede:
- Ver productos habilitados
- Buscar/filtrar
- Ver motivo de deshabilitación
- Reportar como posible duplicado

// Auditor (read-only):
- Ver AuditLog completo
- Ver DisabledEntityHistory
- Ver ProductMergeHistory
- Exportar reportes
```

---

## 🎓 Conclusión: Recomendación Final

**NUNCA hagas hard delete de productos en sistema de inventario.**

### Razones:
1. ❌ Pérdida de auditoría fiscal
2. ❌ Datos huérfanos en documentos
3. ❌ Karma.kdx con histórico roto
4. ❌ Imposibilidad de reconciliación
5. ❌ Multas de compliance

### Alternativas (todas seguras):
- ✅ Soft delete (deshabilitación)
- ✅ Merge (fusión inteligente)
- ✅ Archive (espera 90 días)
- ✅ Hard delete (SOLO si ley lo requiere + 3 confirmaciones)

**Máxima:** "En inventario, los datos muertos son como las facturas: NUNCA se destrozan, solo se archivan."

---

_Documento: ESTRATEGIA_ELIMINACION_DUPLICADOS_PROFUNDO.md_  
_Versión: 1.0_  
_Referencia: PLAN_COMPLETO_GESTION_PRODUCTOS.md_
