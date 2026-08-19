# v7_scripts

Los **fuentes PPL** del catálogo: el código que escriben los funcionales y que el pipeline convierte
en las DLLs que ejecuta el runtime.

> **Se llamaba `ppl_tests`.** El nombre viejo sugería que eran scripts de prueba; son el catálogo
> real. GitHub redirige el nombre anterior, así que un `origin` sin actualizar sigue funcionando.

---

## Ramas

Este repo **no tiene `develop`**: se organiza por ambiente, igual que `v7_compilations`.

| Rama | Para qué |
|---|---|
| `qa` | la rama de trabajo — es donde se commitean los scripts |
| `demo` | el catálogo del ambiente de demo |
| `main` | rama base |

---

## Estructura: una carpeta por tipo de script

Los nombres de carpeta son **plurales**, y ése es el nombre canónico:

| ScriptType (enum) | Carpeta | Singular histórico (aún aceptado) |
|---|---|---|
| `ABM` | `Abms` | `ABM` |
| `Evento` | `Eventos` | `Evento` |
| `Formula` | `Formulas` | `Formula` |
| `Funcion` | `Funciones` | `Funcion` |
| `Informe` | `Informes` | `Informe` |
| `MinutaBolsa` | `MinutasBolsa` | `MinutaBolsa` |
| `Operacion` | `Operaciones` | `Operacion` |
| `Orden` | `Ordenes` | `Orden` |
| `Transaccion` | `Transacciones` | `Transaccion` |
| `OpMinorista` | `OpMinoristas` | `OpMinorista` |
| `Test` / `RemoteTest` / `WebView` | igual que el enum | — |

⚠️ **El nombre del ENUM no cambió** — sigue en singular (`ScriptType.Informe`). Lo que es plural es
la **carpeta**. Toda lectura del filesystem prueba primero la plural y cae a la singular si no
existe, así conviven checkouts migrados y sin migrar; las **escrituras** siempre crean la plural.

---

## Archivos de un script

| Extensión | Qué es |
|---|---|
| `.ppl` | el código fuente |
| `.hppl` | metadata XML (título, permisos). **Es lo que lista el catálogo** |
| `.ppln` | salida del PreTranspiler (PPL normalizado) |

Un **WebView** suma además `.html`, `.css` y `.js`.

⚠️ **Cambiar el `.js` o el `.css` de un WebView exige re-transpilarlo**: se consolidan dentro del
`.html` al transpilar, así que editarlos solo no cambia nada de lo que se sirve.

---

## Cómo se usa este repo

Los scripts **no se compilan desde acá**. El pipeline es:

```
.ppl  ──►  PreTranspiler + v7_transpiler  ──►  .cs  ──►  dotnet build  ──►  .dll
           └──────── TRANSPILAR ────────┘            └─ COMPILAR ─┘
```

- **Desde el navegador**: `v7_compiler` — se elige la carpeta, se eligen los scripts y publica los
  artefactos en `v7_compilations`.
- **Desde la línea de comandos**: `PPL.Dev.Console --f <SCRIPT> --t <Tipo>`, en `v7_back`.

⚠️ **Un fix de transpilación va en el transpilador, no en el `.ppl`.** Los `.ppl` son la fuente de
verdad: si un script válido no transpila, el bug está en el `PreTranspiler` (C#) o en el compilador C
— salvo que sea un error genuino de sintaxis PPL.

---

## Repos hermanos

| Repo | Qué es |
|---|---|
| [`v7_transpiler`](https://github.com/pplnet/v7_transpiler) | transpilador C, PPL → C# |
| [`v7_compiler`](https://github.com/pplnet/v7_compiler) | app web que orquesta la compilación |
| [`v7_compilations`](https://github.com/pplnet/v7_compilations) | las DLLs ya compiladas |
| [`v7_back`](https://github.com/pplnet/v7_back) | backend que las ejecuta |
| [`v7_front`](https://github.com/pplnet/v7_front) | frontend |

La sintaxis de PPL y las convenciones del proyecto están en el `CLAUDE.md` de la raíz.
