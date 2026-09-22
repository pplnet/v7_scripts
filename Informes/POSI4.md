## Para qué sirve

Muestra **qué tiene cada vehículo a una fecha y cuánto vale**: la tenencia por especie, cómo se
movió en el día (cantidad inicial, compras, ventas, cantidad final) y su valuación al cierre, con
el resultado del período.

Es el informe de posiciones que se usa para responder "¿qué tiene este cliente?" y "¿cuánto vale
hoy la cartera?".

## Cuándo usarlo

- Ver la tenencia de un vehículo a una fecha.
- Comparar la valuación de hoy contra el cierre anterior (trae las dos columnas).
- Revisar el movimiento de una especie puntual en el día.

## Qué reporta, columna por columna

Una fila por especie, cortada por **vehículo** y por **book**, con subtotales en cada corte.

| Columna | Qué es |
| --- | --- |
| Especie / Cupón / FechaEj | qué instrumento es y su cupón corriente |
| CantidadIni | lo que había al empezar el día |
| Compras / Ventas | lo que se movió en el día |
| CantidadFin | lo que quedó |
| PrecioFin | el precio usado para valuar |
| Cierre (fecha) / Cierre (hábil anterior) | los dos cierres, para comparar |
| Variación Nominales | cuánto cambió la tenencia |
| Valuación | cuánto vale la posición a la fecha |
| Trading Day | el resultado del día |

## Los filtros que confunden

| Campo | Qué hace de verdad |
| --- | --- |
| **Vehiculo** | **arranca precargado** con el vehículo por defecto del usuario, no en "Todos". Dos personas abriendo el informe ven conjuntos distintos si no lo tocan |
| **Book** | vacío significa **todos** los books, no ninguno |
| **Incluye $** | apagado por defecto: **excluye la moneda local**. Prenderlo suma las posiciones en pesos |
| **Inc.Pos.0** | apagado por defecto: esconde las especies que quedaron en cero |
| **Concertada / Liquidada** | por fecha de concertación o de liquidación. Cambia qué operaciones entran |
| **Inc.Resultados** | prendido por defecto: agrega las columnas de resultado |

## Relacionado

Existe un **WebView homónimo (`POSI4`)** que muestra lo mismo en pantalla, con la grilla
actualizándose sola. Si alguien compara los dos y los números no coinciden, casi siempre es por los
filtros de vehículo y book, que en el WebView arrancan distinto.
