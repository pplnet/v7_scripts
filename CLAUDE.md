# ppl_tests - Archivos Fuente PPL de Prueba

## Rutas a Otros Repositorios (desde esta carpeta)
| Repositorio | Ruta relativa |
|-------------|---------------|
| Raíz del proyecto | `..` |
| Transpilador (C) | `../v7` |
| Backend (.NET) | `../v7_proto` |
| Frontend (Next.js) | `../v7_web` |
| CLAUDE.md raíz | `../CLAUDE.md` |

---

## Descripción

Repositorio de archivos fuente PPL organizados por tipo de script. Estos archivos son compilados por el transpilador (`v7`) y ejecutados por el backend (`v7_proto`).

---

## Estructura

```
ppl_tests/
├── Evento/              # Scripts de evento (1 script)
│   └── EVTEST.*
├── Informe/             # Scripts de informe/reporte (5 scripts)
│   └── DIAL, DMOTST, GRDTST, INFTST, RECALC
├── RemoteTest/          # Suite de tests PPL (52 scripts)
│   └── Tests de operadores, colecciones, control de flujo, etc.
├── WebView/             # Interfaces web interactivas (2 scripts)
│   └── ESTORD, CRTORD (cada uno con .ppl, .html, .css, .js, .hppl)
└── .gitignore
```

---

## Tipos de Archivo

| Extensión | Descripción | Versionado |
|-----------|-------------|------------|
| `.ppl` | Código fuente PPL | Sí |
| `.hppl` | Metadata XML del script (título, permisos, tipo) | Sí |
| `.ppln` | PPL normalizado (salida del PreTranspiler) | No (en .gitignore) |
| `.html` | Template HTML (solo WebView) | Sí |
| `.css` | Estilos (solo WebView) | Sí |
| `.js` | JavaScript (solo WebView) | Sí |

---

## Convenciones de Naming

- **Nombres de script**: SIEMPRE en **MAYÚSCULAS** (ej: `LIST`, `ESTORD`, `EVTEST`)
- **Todos los archivos** de un script comparten el mismo nombre base con diferente extensión
- **Prefijos comunes en RemoteTest**:
  - `BOP*` → Tests de operadores binarios (BOPADD, BOPSUB, BOPMUL, etc.)
  - `*ERR` → Tests de manejo de errores (CATERR, CALLFUNCERR)
  - `*_FULL` → Versiones extendidas (DEF_FULL, DIALOG_FULL)

---

## Archivos de un WebView

Cada WebView consta de **6 archivos** que trabajan juntos:
```
SCRIPTID.ppl   → Lógica PPL (funciones, queries SQL)
SCRIPTID.html  → Estructura HTML del componente
SCRIPTID.css   → Estilos personalizados
SCRIPTID.js    → Lógica JavaScript del frontend
SCRIPTID.hppl  → Metadata XML
SCRIPTID.ppln  → Generado automáticamente (no editar)
```

---

## WebView: filtros server-side + fecha del sistema (FSYS)

Un WebView puede filtrar **server-side** pasando argumentos a su función PPL vía `bound.execPPL`
(el JS arma la expresión con los args inline, igual que `GetDetalleOperacion('...')`) y construyendo
el `WHERE` dinámicamente en la función. Patrón usado por **ESTOPE** (filtro por rango de fecha):

- **JS** llama `bound.execPPL("GetOperaciones('" + desde + "','" + hasta + "')")` — cada arg como
  string ISO `yyyy-MM-dd` del `<input type="date">`. Validar en el JS con `^\d{4}-\d{2}-\d{2}$`
  antes de pasarlo.
- **PPL** arma el filtro con `If NoVacio(param) ... EndIf` + concatenación `~` (extremo vacío ⇒ lado
  del rango abierto). **Sanitizar toda fecha con `IdxDate(param)`** antes de meterla en el SQL:
  devuelve `yyyyMMdd` (SQL-safe, sin inyección; input inválido ⇒ `19000101`). El compare va como
  `CONVERT(date, O.FechaOp) >= '" ~ IdxDate(param) ~ "'`.

**Fecha del sistema (FSYS) en un WebView**: no hay global JS con FSYS — se pide al backend. Función
PPL que la devuelve como ISO para el date picker:

```ppl
def GetFechaSistema()
    &sql := "SELECT '" ~ Fecha(FSys, 'yyyy-mm-dd') ~ "' as Fecha"
    return QueryTable(&sql)
end
```

`FSys` (bareword, sin paréntesis — igual que en eventos/informes) es la fecha lógica del sistema
(≠ `GETDATE()`). `Fecha(f, 'yyyy-mm-dd')` la formatea ISO (el backend lowercasea la máscara y
`mm→MM`, así que da `yyyy-MM-dd`). Se devuelve como tabla 1×1 para reusar el mismo pipeline
`transformData`/`capKey` del JS. El JS setea ambos inputs con ese valor **al iniciar** y recién ahí
carga la grilla → al abrir se ven solo las operaciones del día (default FSYS..FSYS). Los filtros de
fecha van **por encima** de los demás filtros en el HTML.

`NoVacio`, `IdxDate`, `Fecha` y `FSys` son PMFuncs disponibles en el compilador `inf` (el de los
WebView) — mismo patrón de `If/EndIf` + concatenación dentro de un `def` que usa `CRTORD.CrearOrden`.

⚠️ **Tras editar el `.ppl`/`.html`/`.js`/`.css` de un WebView hay que RE-TRANSPILARLO y redeployarlo**
(`PPL.Dev.Console --f ESTOPE --t WebView`): regenera el C# de las funciones nuevas y el HTML
consolidado de `ppl_deploy/WebView/{id}/`. Los archivos bajo `ppl_deploy/`, `transpilations-*` son
artefactos generados — **no editarlos a mano**.

**WebViews existentes**: `ESTORD` (estado de órdenes), `CRTORD` (alta de orden), `ESTOPE` (estado de
operaciones, con filtro por fecha).

---

## Sintaxis PPL Rápida

```ppl
** Variables
&nombre := 'valor'
&numero := 42
&lista := $[1, 2, 3]
&dic := ${clave=valor}

** Control de flujo
If &x > 10
    Mostrar('grande')
EndIf

** Funciones
def MiFuncion(arg1, arg2)
    return arg1 + arg2
end

** Tests
test('mi test', -> {
    assertEq(esperado, actual)
})
```

Para referencia completa de sintaxis PPL, ver `../CLAUDE.md` sección "Sintaxis PPL".

---

## Agregar un Nuevo Test

1. Crear `RemoteTest/NOMBRE.ppl` con el código del test
2. Crear `RemoteTest/NOMBRE.hppl` con metadata XML:
```xml
<?xml version="1.0" encoding="utf-8"?>
<ScriptHeader>
  <Title>Descripción del test</Title>
  <ScriptType>RemoteTest</ScriptType>
  <ScriptId>NOMBRE</ScriptId>
</ScriptHeader>
```
3. El `.ppln` se genera automáticamente al compilar

---

## Auto-actualización de este archivo

**OBLIGATORIO**: Cada vez que se agregue una funcionalidad nueva, se establezca una convención, o se especifique una forma particular de hacer algo en este repositorio, el agente **DEBE actualizar este CLAUDE.md** para documentar la nueva regla o convención. También actualizar el `../CLAUDE.md` raíz si el cambio es relevante a nivel proyecto.
