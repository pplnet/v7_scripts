## Para qué sirve

**Cruza cada operación con las transacciones que la liquidaron.** Por operación muestra sus
movimientos y, de cada uno, la transacción a la que pertenece, con sus cuentas y sus fechas.

Sirve para responder *"¿por qué transacción se liquidó esta operación?"* y *"¿contra qué cuenta
fue?"*.

## Cuándo usarlo

- Rastrear de qué transacción salió el movimiento de una operación.
- Ver las cuentas y el corresponsal con los que liquidó.
- Revisar un rango de vencimientos y qué se liquidó de cada uno.

## Qué reporta

Una fila por movimiento, ordenada por tipo de operación, especie, operación y transacción. De la
operación trae tipo, número, cliente, especie, cantidad, precio y fechas; del movimiento, su fecha,
su cantidad y su leyenda; y de la transacción, su tipo, su número, sus fechas y **sus dos cuentas**,
con el número de cuenta, el corresponsal y el comitente de la primera.

⚠️ **No es una fila por operación.** Una operación con varios movimientos ocupa varias filas, y sus
datos de cabecera se repiten en cada una.

## 🔴 Son CUATRO fechas obligatorias, y dos filtran cosas distintas

| Campo | Filtra por | Arranca en |
| --- | --- | --- |
| **Fecha Desde** / **Fecha Hasta** | la **fecha de operación** | el día operativo |
| **F.Vto.Desde** | la **fecha de vencimiento** | el día operativo |
| **F.Vto.Hasta** | la **fecha de vencimiento** | el día operativo **+ 30** |

Las cuatro se aplican a la vez y las cuatro son obligatorias. Abrir el informe y aceptar trae lo
operado **hoy** que venza **en los próximos 30 días** — un recorte bastante angosto que explica la
mayoría de los *"no trae nada"*.

⚠️ **Son dos rangos independientes.** Ampliar el de operación no sirve de nada si el de vencimiento
sigue cerrado, y es el que menos se mira porque su default parece «abierto».

## Los otros filtros

| Campo | Qué hace de verdad |
| --- | --- |
| **Vehiculo** | **obligatorio y precargado** con el del usuario. No hay «todos» |
| Especie · Nro. Op. · Book | opcionales. Vacío = todos |
| **Cliente** | opcional, pero ver abajo |
| **Tipos Op.** | multiselect. Vacío = todos |

## ⚠️ Cargar el cliente agrega una condición de más

Filtrando por cliente, el informe exige además que **el cliente del movimiento sea el mismo que el
de la operación**. Los movimientos que la operación haya generado a nombre de otro —el vehículo, una
contraparte— **quedan afuera**.

Consecuencia: la misma operación muestra **menos filas** filtrando por su cliente que sin filtrar. No
es un error; es una condición extra que sólo aparece con ese campo cargado.

## Relacionado

- **`MOVOPE`** — los movimientos de una operación, sin el cruce con la transacción y con filtros
  mucho más simples. Para mirar una operación puntual suele alcanzar.
