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
├── WebView/             # Interfaces web interactivas
│   └── ESTORD, CRTORD, ESTOPE, MNTNTF, ... (cada uno con .ppl, .html, .css, .js, .hppl)
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

## WebViews en tiempo real: SignalR + firehose de notificaciones

Los WebViews consolidados ya traen el cliente **SignalR 8** embebido (lo inyecta
`WebViewConsolidator`), disponible como el global `signalR`. Patrón para un WebView que consuma
eventos en tiempo real:

```javascript
const hub = new signalR.HubConnectionBuilder()
    .withUrl(window.API_BASE_URL + '/hubs/ppl', { withCredentials: true })
    .withAutomaticReconnect()
    .build();
hub.on('ReceiveMessage', function (messageCode, payload) { /* ... */ });
hub.start().then(function () { hub.invoke('Subscribe', '<GRUPO>'); });
```

- **Grupo `user:{CODIGO}`**: se **auto-une en `OnConnectedAsync`** (no hace falta `Subscribe`). Recibe
  los eventos de proceso `PROCESS_COMPLETED` / `PROCESS_ERROR` / `PROCESS_CANCELLED` / `PROCESS_MESSAGE`
  / `PROCESS_MESSAGEBOX_REQUEST` y de mensajería `NOTIFICATION_NEW` / `NOTIFICATION_DELETED`.
- **Firehose `__NOTIF_ALL__`**: grupo **no-chat** (cualquier cliente puede `Subscribe`, sin
  restricción de perfil). Recibe **TODA** notificación PPL (sección `NOTIFICACION` / función
  `Notificar`) con el **grupo real como `messageCode`**; el `payload` puede ser plano, un **sobre**
  `{v,grupo,id,severidad,mensaje,datos}` o un **batch** coalescido `{coalesced,grupo,items[]}` — el
  cliente debe tolerar las tres formas.
- Los grupos de chat (`user:`/`channel:`/`op:`/`profile:`) sí están autorizados por identidad/perfil
  en `PPLHub`; el resto de los grupos pasan libres. Ver detalle en `../v7_proto/CLAUDE.md` →
  "Mejoras del pipeline de notificaciones" y "El grupo `user:{CODIGO}` se une en `OnConnectedAsync`".

### WebViews de ejemplo

| WebView | Qué hace |
|---------|----------|
| **MNTNTF** (Monitor de Notificaciones) | Monitor universal 100% client-side: acumula TODA notificación en una grilla (tipo/origen/grupo/severidad/mensaje) con filtros, orden, pausa, límite de buffer y detalle expandible con el payload crudo. Escucha **cuatro fuentes**: firehose `__NOTIF_ALL__` (notificaciones PPL), grupo `user:{CODIGO}` (procesos + menciones + ops donde participa), **`channel:global`** y los **`channel:{id}` visibles** (chat de canales). Su `.ppl` expone `GetServerInfo` + `GetGruposChat`. |

### Capturar el CHAT en un WebView (los `channel:*` no llegan por `user:{code}`)

El chat NO viaja por el firehose. El backend emite `NOTIFICATION_NEW`/`NOTIFICATION_DELETED`/`NOTIFICATION_READ`
(payload `MessageDto`: `Usuario`/`Message`/`ChannelName`/`Type`) y `OP_UNREAD` (`{nr,usuario}`) **por grupo de
chat**: `channel:{id}` / `channel:global` / `op:{nr}` / `profile:{code}` (+ `user:{code}` sólo para menciones y
ops donde participás). Un WebView auto-unido sólo a `user:{code}` **se pierde toda la mensajería de canales**.

**Para capturarla** (patrón de MNTNTF):
1. Suscribirse a **`channel:global`** (todo autenticado está autorizado — capta el chat público).
2. Suscribirse a los **`channel:{id}`** que el usuario puede ver. En vez de replicar la visibilidad de canales
   en el webview, una PPLFunc (`GetGruposChat` → `SELECT 'channel:'+Id FROM MENSAJES_CANALES`) devuelve TODOS
   los canales candidatos y **`hub.invoke('SubscribeMany', grupos)`** deja que **`PPLHub` autorice cada uno**
   por perfil (los restringidos se saltean silenciosamente — es la fuente de verdad, ver
   `../v7_proto/CLAUDE.md` → `PPLHub.IsChatGroupAllowed`).
3. Re-suscribirse en cada `onreconnected` (la membresía se pierde con el connectionId nuevo).
4. Dedupear la **re-entrega multi-grupo** (un mensaje de canal que además te menciona llega por `channel:{id}`
   Y por `user:{code}`) por `(code,id)` del `MessageDto` en una ventana corta.
5. `MessageDto.Type` es `info`/`warning`/**`alert`** (no `alerta`) — normalizar al mapear la severidad.

**Límite conocido**: los canales de **perfil** (`profile:{code}`, gated por `ActivateProfileChannels`) no se
monitorean (requieren los perfiles del usuario); las ops se ven vía `OP_UNREAD` (aviso) + `user:{code}` (texto,
si sos participante).
| **ESTOPE** (Estado de Operaciones) | Réplica en WebView del informe homónimo `Informe/ESTOPE`. Grilla de operaciones con su **estado = instancia activa** (`OPERACIONESBITS.Valor=1` → `INSTANCIAS.Nombre`; primera columna **Instancia**), fechas/especie/moneda/tipo/mercado/cliente/cantidad/precio/vehículo/operador. **Filtro por fecha server-side** (`GetOperaciones(desde,hasta)` con `IdxDate` para SQL-safe; default `FSYS..FSYS` vía `GetFechaSistema()` → al abrir sólo se ven las operaciones del día) + filtros por tipo/estado, **detalle por modal (doble click)**, y **refresh en tiempo real** (debounced) al recibir eventos `PROCESS_*` o notificaciones de grupos de operaciones. |

> ⚠️ **DataTables con `scrollX: true`**: el header vive en una tabla separada del cuerpo, y `$$.setData` (helper del consolidador) hace `draw()` **pero NO `columns.adjust()`** → un contenido ancho (ej. un nombre de instancia largo) desfasa el header respecto del cuerpo. Todo WebView con `scrollX` debe llamar `dataTable.columns.adjust()` **tras cada `$$.setData(...)`** y en el evento `resize` de la ventana (ver `ESTOPE.js::adjustColumns`).

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
