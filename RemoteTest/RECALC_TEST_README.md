# Test de Recálculo de Campos - RECALC_TEST.ppl

## Descripción

Este script PPL prueba la funcionalidad de **recálculo automático de campos dependientes** en diálogos PPL. Simula un escenario de factura simple con campos editables y campos calculados que se recalculan automáticamente cuando cambian sus dependencias.

---

## Escenario: Factura Simple

### Campos Editables (Columna 1)
| Campo | Label | Valor Inicial | Descripción |
|-------|-------|---------------|-------------|
| `Cantidad1` | Cantidad | 10 | Cantidad de productos |
| `Cantidad2` | Precio Unitario | 100 | Precio por unidad |
| `Cantidad3` | Tasa IVA % | 21 | Porcentaje de IVA |

### Campos Calculados (Columna 2)
| Campo | Label | Fórmula | Descripción |
|-------|-------|---------|-------------|
| `Cantidad4` | Subtotal | `Cantidad1 * Cantidad2` | Subtotal sin IVA |
| `Cantidad5` | IVA | `Cantidad4 * Cantidad3 / 100` | Monto del IVA |
| `Cantidad6` | Total | `Cantidad4 + Cantidad5` | Total con IVA |

---

## Grafo de Dependencias

```
Cantidad1 (10) ─────┐
                    ├──> Cantidad4 (1000) ─────┐
Cantidad2 (100) ────┘           │              ├──> Cantidad6 (1210)
                                │              │
                                └──> Cantidad5 (210) ─┘
Cantidad3 (21) ─────────────────┘
```

**Leyenda:**
- `Cantidad1` y `Cantidad2` → afectan a `Cantidad4` (Subtotal)
- `Cantidad4` → afecta a `Cantidad5` (IVA) y `Cantidad6` (Total)
- `Cantidad3` → afecta a `Cantidad5` (IVA)
- `Cantidad5` → afecta a `Cantidad6` (Total)

---

## Propiedades de Recálculo Esperadas

### Backend debe marcar:

#### `Cantidad1` (Cantidad):
```json
{
  "id": "Cantidad1",
  "hasDependentFields": true,
  "editable": true
}
```

#### `Cantidad2` (Precio Unitario):
```json
{
  "id": "Cantidad2",
  "hasDependentFields": true,
  "editable": true
}
```

#### `Cantidad3` (Tasa IVA %):
```json
{
  "id": "Cantidad3",
  "hasDependentFields": true,
  "editable": true
}
```

#### `Cantidad4` (Subtotal):
```json
{
  "id": "Cantidad4",
  "hasDependentFields": true,
  "dependsOn": ["Cantidad1", "Cantidad2"],
  "editable": false,
  "requiresServer": true
}
```

#### `Cantidad5` (IVA):
```json
{
  "id": "Cantidad5",
  "hasDependentFields": true,
  "dependsOn": ["Cantidad4", "Cantidad3"],
  "editable": false,
  "requiresServer": true
}
```

#### `Cantidad6` (Total):
```json
{
  "id": "Cantidad6",
  "hasDependentFields": false,
  "dependsOn": ["Cantidad4", "Cantidad5"],
  "editable": false,
  "requiresServer": true
}
```

---

## Casos de Prueba

### 1. Valores Iniciales
**Estado inicial esperado:**
- Cantidad: 10
- Precio Unitario: 100
- Tasa IVA %: 21
- **Subtotal: 1000** (10 × 100)
- **IVA: 210** (1000 × 21%)
- **Total: 1210** (1000 + 210)

### 2. Cambio de Cantidad
**Acción:** Cambiar Cantidad de 10 a 20

**Flujo de recálculo:**
1. Usuario cambia `Cantidad1` → 20
2. Frontend detecta `hasDependentFields=true`
3. Frontend llama `POST /ppl-process/recalc/{processId}` con `changedField: "Cantidad1"`
4. Backend recalcula:
   - `Cantidad4`: 20 × 100 = **2000**
   - `Cantidad5`: 2000 × 21% = **420** (recálculo en cascada)
   - `Cantidad6`: 2000 + 420 = **2420** (recálculo en cascada)
5. Frontend actualiza los valores

**Resultado esperado:**
- Subtotal: 2000
- IVA: 420
- Total: 2420

### 3. Cambio de Precio Unitario
**Acción:** Cambiar Precio Unitario de 100 a 150

**Resultado esperado:**
- Subtotal: 1500 (10 × 150)
- IVA: 315 (1500 × 21%)
- Total: 1815 (1500 + 315)

### 4. Cambio de Tasa IVA
**Acción:** Cambiar Tasa IVA de 21% a 10%

**Resultado esperado:**
- Subtotal: 1000 (sin cambios)
- IVA: 100 (1000 × 10%)
- Total: 1100 (1000 + 100)

### 5. Cambios Múltiples
**Acción:**
- Cantidad → 5
- Precio Unitario → 200
- Tasa IVA → 15%

**Resultado esperado:**
- Subtotal: 1000 (5 × 200)
- IVA: 150 (1000 × 15%)
- Total: 1150 (1000 + 150)

---

## Cómo Usar Este Test

### 1. Compilar el script
```bash
cd v7/compiler/ops/bin
./ppl ../../../ppl_tests/RemoteTest/RECALC_TEST.ppl
```

### 2. Iniciar el backend
```bash
cd v7_proto/PPLRuntime
dotnet run
```

### 3. Iniciar el frontend
```bash
cd v7_web
npm run dev
```

### 4. Ejecutar el script desde el frontend
1. Abrir http://localhost:3000
2. En el sidebar, buscar "RECALC_TEST" o "Test de Recálculo de Campos"
3. Hacer click para ejecutar
4. Se abrirá el diálogo con los 6 campos

### 5. Probar manualmente
- **Modificar Cantidad**: Observar que Subtotal, IVA y Total se recalculan automáticamente
- **Modificar Precio Unitario**: Observar los recálculos en cascada
- **Modificar Tasa IVA**: Observar que solo IVA y Total cambian
- **Verificar debounce**: Escribir rápido y observar que el recálculo se dispara 300ms después de dejar de escribir
- **Verificar loading**: Observar el indicador "Recalculando campos..." durante el recálculo
- **Verificar campos deshabilitados**: Los campos calculados (Subtotal, IVA, Total) deben estar deshabilitados durante el recálculo

### 6. Ejecutar tests automáticos (opcional)
Si el backend soporta ejecutar tests:
```bash
# Desde v7/compiler/ops/bin
./ppl -r ../../../ppl_tests/RemoteTest/RECALC_TEST.ppl
```

---

## Comportamiento Esperado del Frontend

### Al cambiar un campo editable:
1. ✅ El valor se actualiza inmediatamente en el UI (UX responsiva)
2. ✅ Se verifica si el campo tiene `hasDependentFields=true`
3. ✅ Si tiene dependientes, se activa el debounce de 300ms
4. ✅ Después de 300ms sin más cambios, se llama al endpoint de recálculo
5. ✅ Durante el recálculo:
   - Aparece indicador "Recalculando campos..."
   - Los campos calculados (no editables) se deshabilitan
   - El botón "Continuar" se deshabilita
6. ✅ Al recibir la respuesta, se actualizan los valores de los campos recalculados
7. ✅ El indicador desaparece y los campos vuelven a su estado normal

### Comportamiento del debounce:
- Si el usuario escribe "2" → "20" → "200" rápidamente
- Solo se hace **1 llamada** al backend después de 300ms del último cambio
- Esto evita sobrecargar el servidor con llamadas innecesarias

---

## Debugging

### Activar modo debug
En `ScriptRunner.tsx`, pasar `debugMode={true}` al componente `PPLDialog`:
```tsx
<PPLDialog
  dialogDefinition={dialogDefinition}
  processId={processId}
  onClose={handleDialogClose}
  onSubmit={handleDialogSubmit}
  debugMode={true}  // <-- Agregar esta línea
/>
```

Esto mostrará información de debugging al final del diálogo con:
- FormData actual
- Errores actuales

### Verificar llamadas al endpoint
Abrir DevTools (F12) → Network → Filtrar por "recalc"

Deberías ver:
```
POST /ppl-process/recalc/{processId}
Request:
{
  "changedField": "Cantidad1",
  "formData": {
    "Cantidad1": 20,
    "Cantidad2": 100,
    "Cantidad3": 21,
    "Cantidad4": 1000,
    "Cantidad5": 210,
    "Cantidad6": 1210
  }
}

Response:
{
  "recalculatedFields": {
    "Cantidad4": 2000,
    "Cantidad5": 420,
    "Cantidad6": 2420
  }
}
```

### Logs del backend
El backend debería loggear:
```
[RecalcFields] Process: abc123, Changed: Cantidad1
[PMDialog.BuildDependencyGraph] Construyendo grafo...
[PMDialog.Recalc] Recalculando Cantidad4, Cantidad5, Cantidad6
```

---

## Troubleshooting

### Problema: Los campos no se recalculan
**Solución:**
1. Verificar que el backend esté marcando `hasDependentFields=true` en los campos editables
2. Verificar que `processId` se esté pasando al componente `PPLDialog`
3. Abrir DevTools y verificar si hay errores en la consola

### Problema: El recálculo se dispara demasiadas veces
**Solución:**
1. Verificar que el debounce esté funcionando (debería ser 300ms)
2. Verificar que no haya múltiples instancias del componente

### Problema: Los valores calculados están incorrectos
**Solución:**
1. Verificar las fórmulas en el archivo `.ppl`
2. Verificar que el backend esté evaluando las fórmulas correctamente
3. Revisar los logs del backend para ver qué valores está calculando

### Problema: Error "Cannot read property 'hasDependentFields' of undefined"
**Solución:**
El campo no existe en la definición del diálogo. Verificar que:
1. El script esté compilado correctamente
2. El backend esté retornando todos los campos en `dialogDefinition.fields`

---

## Extensiones Futuras

### 1. Evaluación Local (Opcional)
Para optimizar, el backend podría enviar `localFormula` en campos simples:

```json
{
  "id": "Cantidad4",
  "localFormula": "formData.Cantidad1 * formData.Cantidad2",
  "requiresServer": false
}
```

El frontend podría evaluar esto localmente sin llamar al backend, mejorando la latencia.

### 2. Más Tipos de Campos
Extender el test para incluir:
- Campos de texto con concatenación
- Campos de fecha con cálculos de días
- Campos de checkbox que habilitan/deshabilitan otros campos
- Campos de combo que filtran opciones de otros campos

### 3. Validación Dependiente
Agregar validaciones que dependan de otros campos:
```ppl
Cantidad7: 'Stock Disponible' ;4;1;1;NO;SI;SI;;SI;100;;;;
Cantidad8: 'Stock Final'       ;4;2;1;NO;SI;Dialogo.Cantidad7 - Dialogo.Cantidad1 >= 0;;SI;;Dialogo.Cantidad7 - Dialogo.Cantidad1;;;
```

---

## Autor
Sistema V7 - Test de Recálculo de Campos

## Fecha
Enero 2026
