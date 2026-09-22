## Para qué sirve

**Las posiciones valuadas con criterio contable**, a una fecha. Muestra la tenencia por especie con
su movimiento del día y su valuación, igual que POSI4, pero tomando los datos contables.

## ⚠️ POSICO vs POSI4 — la confusión típica

Los dos muestran "posiciones y resultados" y se parecen mucho en pantalla. Las diferencias reales:

| | POSICO (éste) | POSI4 |
| --- | --- | --- |
| Criterio | **contable** | de gestión |
| Arranca en | **Liquidada** | Concertada |
| Partidas | tiene `Inc.Partidas` | no |
| De dónde lee | `POSICIONES` + `RESULTADOS` | `POSICIONES` |

⚠️ **Los dos abren con un default distinto en Concertada/Liquidada.** Si alguien compara POSICO
contra POSI4 sin tocar nada, ya está comparando dos cosas distintas y los números no van a dar
iguales. Es lo primero que hay que igualar antes de buscar una diferencia real.

## Los filtros que confunden

| Campo | Qué hace de verdad |
| --- | --- |
| **Inc.Partidas** | apagado por defecto. 🔴 **Apagado, la lista de Books ESCONDE los books que valúan por partida** — no es sólo una columna de más: cambia qué books se pueden elegir |
| **Inc.Resultados** | prendido, pero **sólo se puede tocar con Liquidada**; con Concertada queda atado a `Inc.Partidas` |
| **Incluye $** | apagado: excluye la moneda local |
| **Inc.Pos.0** | apagado: esconde las especies que quedaron en cero |
| **Concertada / Liquidada** | arranca en **Liquidada** |
| **Especie / Vehiculo / Book** | acotan; vacío es todos |

## Qué reporta

Una fila por especie: cantidad inicial, compras, ventas, cantidad final, precio de cierre, los dos
cierres para comparar, variación de nominales y valuación.
