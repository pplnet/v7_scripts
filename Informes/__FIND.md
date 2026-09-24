## Para qué sirve

**Busca un texto adentro del código de los scripts.** Recorre el fuente de ABMs, informes, eventos,
fórmulas, funciones y los tipos de operación, transacción, orden y minuta de bolsa, y lista los que
contienen lo que se buscó.

Es la herramienta para responder *"¿quién usa esta función?"*, *"¿dónde se escribe en esta tabla?"*
o *"¿qué scripts tocan este campo?"* sin abrirlos uno por uno.

## Cuándo usarlo

- Antes de cambiar una fórmula o una función: ver quién la llama.
- Rastrear de dónde sale un valor: buscar el nombre de la tabla o de la columna.
- Encontrar un script del que sólo se recuerda una frase del título o un comentario.

## Los filtros

| Campo | Qué hace |
| --- | --- |
| **Buscar Texto** | obligatorio. Es el texto a encontrar; no admite comodines |
| **CaseSensitive** | apagado por defecto: busca **sin distinguir mayúsculas**. Prenderlo exige la coincidencia exacta |
| **Todos** | **arranca prendido**, y prende los nueve tipos a la vez |
| ABMs · Eventos · Formulas · Funciones · Informes · TiposMinutaBolsa · TiposOperacion · TiposOrden · TiposTransaccion | acotan a un tipo de script |

⚠️ **Tildar un tipo apaga «Todos» solo**, y destildarlos todos lo vuelve a prender. No hace falta
destildar «Todos» a mano antes de elegir uno.

## Qué devuelve

Una fila por script encontrado, con la tabla donde vive, su código, su tipo y su nombre.

⚠️ **No muestra en qué línea apareció el texto ni cuántas veces.** Dice qué scripts mirar, no dónde
mirar adentro de cada uno.

## 🔴 Busca en la BASE, no en los archivos del catálogo

El fuente que recorre sale de las tablas `INFORMES`, `EVENTOS`, `ABMS`, `FORMULAS`, `FUNCIONES` y
las de tipos — **el mismo que ejecuta v6**, no los `.ppl` del repositorio de scripts.

Normalmente son lo mismo: publicar desde PPL Studio escribe las dos puntas. Pero se pueden separar:

| Si pasó esto | `__FIND` encuentra |
| --- | --- |
| Alguien editó el script **desde v6** | la versión de v6 — el `.ppl` del catálogo tiene otra |
| Se publicó desde Studio y la escritura a la base falló | la versión **anterior** |

⚠️ **No hay ninguna señal en el informe de que eso esté pasando.** Si un resultado no cierra con lo
que dice el `.ppl`, la diferencia es ésa.

## Por qué tarda

No puede filtrar por el texto dentro del `WHERE`: en Oracle la columna del fuente es un `LONG` y no
se puede usar en un filtro. Así que **trae todos los scripts de cada tipo elegido y compara uno por
uno desde PPL**.

⚠️ **Acotar por tipo hace diferencia de verdad.** Buscando sólo en informes se leen ~500 scripts;
con «Todos», varios miles.
