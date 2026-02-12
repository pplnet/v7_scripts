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
