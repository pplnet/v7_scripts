## Para qué sirve

**Lista los futuros de moneda que vencen en un rango**, con el fixing contra el que se van a
liquidar y el precio de la operación.

Es el informe para ver qué hay por vencer y a qué cotización va a cerrar cada posición.

## Cuándo usarlo

- Ver los vencimientos de futuros de moneda de los próximos días.
- Revisar contra qué fixing va a liquidar cada operación.
- Totalizar por mercado lo que vence.

## Qué reporta, columna por columna

| Columna | Qué es |
| --- | --- |
| Operacion / TipoOp | `FXCF` (compra) o `FXVF` (venta) |
| Cliente / Book / Mercado | de quién es y dónde está |
| FechaOp | cuándo se operó |
| **FechaPrecan** | la fecha de precancelación, si la hay |
| **FechaVto** | la que manda: ver abajo |
| Cot. fix | la cotización del fixing |
| Cantidad / PrecioOp | lo operado |
| **Precio fixing** / **Fixing** | contra qué liquida |

Corta por **mercado**, con un subtotal *«Total de Mercado …»* en cada cambio.

⚠️ Si no hay nada en el rango, imprime *«Sin informacion para estas fechas»* en vez de salir vacío.

## 🔴 Una operación PRECANCELADA vence en otra fecha

La columna FechaVto no es siempre la de vencimiento de la operación: **si está marcada como
precancelada, muestra la fecha de precancelación**.

Pero el **filtro** de fechas del diálogo se aplica siempre sobre la fecha de vencimiento original.

Consecuencia: una operación precancelada puede aparecer con una fecha **fuera del rango que se
pidió** — la columna dice una cosa y el filtro usó otra. No es un error del informe: son dos fechas
distintas y sólo una se filtra.

## Los filtros

| Campo | Qué hace de verdad |
| --- | --- |
| **D./H.Fecha.vto** | obligatorias, las dos arrancan en el **día operativo**. Hay que abrir el rango a mano |
| **Vehiculo** | **obligatorio y precargado** con el del usuario. No hay «todos» |
| **Fixing** | multiselect. Vacío = todos. Sólo ofrece las especies de fixing (las que cuelgan de `OCTFIX` en la jerarquía) |
| **Books** | multiselect. Vacío = todos |
| **Mercados** | multiselect. Vacío = todos. Sólo ofrece mercados de futuros de moneda |

⚠️ **Las dos fechas arrancan en el mismo día**, así que abrir el informe y aceptar trae únicamente
lo que vence **hoy**. Es el motivo más común de un informe que «no trae nada».

## ⚠️ Excluye lo anulado, no lo liquidado

Filtra las operaciones cuya instancia **30** no esté activa — o sea, saca las anuladas. **No filtra
por liquidadas**: una operación ya liquidada sigue apareciendo si su vencimiento cae en el rango.

## Relacionado

Sólo mira los tipos `FXCF` y `FXVF`. Otros futuros no entran.
