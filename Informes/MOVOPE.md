## Para qué sirve

**Abre una operación y muestra todos los movimientos que generó.** Por cada operación imprime su
cabecera y, debajo, los asientos de cantidades que produjo: saldo, cuenta, transacción, comprobante
y número de movimiento.

Es el informe para responder *"¿esta operación qué movió?"* y para rastrear de dónde salió un saldo.

## Cuándo usarlo

- Ver el detalle de una operación puntual.
- Entender por qué una cuenta quedó con un saldo que no se esperaba.
- Encontrar el número de transacción y de comprobante de un movimiento.

## Qué reporta

**Dos niveles.** Arriba la operación (tipo, número, fechas, cliente, especie, cantidad, precio,
vehículo) y debajo una fila por movimiento:

| Columna | Qué es |
| --- | --- |
| Estado | de qué tabla salió el movimiento |
| Fecha Eje. / Fecha Mov. | cuándo se ejecutó y cuándo se imputó |
| Cliente | la razón social, **recortada a 30 caracteres** |
| Especie | con su fecha y precio de ejercicio, si los tiene |
| Cantidad | lo movido |
| Leyenda | **recortada a 17 caracteres** |
| Nr.Saldo / Cuenta / Transaccion | dónde impactó |
| Nr.Comp. / Nr.Trans. / Nr.Grupo. / Nr.Mov. | los identificadores para rastrearlo |
| Mercado | el del movimiento, que **puede no ser el de la operación** |

## 🔴 El número de operación ANULA los otros dos filtros

El informe arma su filtro de una de dos formas, y son excluyentes:

| Si se carga | Filtra por |
| --- | --- |
| **Nr.Operacion** | **sólo** esa operación — ignora las fechas **y el vehículo** |
| nada | el rango de fechas, y el vehículo si se cargó |

⚠️ Cargando el número de operación **y** un rango de fechas, el rango no se aplica. La operación
sale aunque su fecha esté fuera. No es un error: el filtro por número tiene prioridad total.

## Los filtros

| Campo | Qué hace de verdad |
| --- | --- |
| **Vehiculo** | opcional y **sin precargar**, al revés que casi todos los informes. Vacío = todos |
| **F.Desde** / **F.Hasta** | obligatorias, las dos arrancan en el **día operativo** |
| **Nr.Operacion** | opcional, y si se carga manda |

⚠️ **Las dos fechas arrancan en el mismo día.** Sin cargar un número de operación, abrir y aceptar
trae sólo lo operado **hoy**.

⚠️ **El rango es por fecha de OPERACIÓN**, no por la de los movimientos. Una operación de la semana
pasada con movimientos de ayer no entra por el rango de ayer.

## ⚠️ El nombre puede ser de un vehículo, no de un cliente

Si el movimiento no es de un cliente, la columna cae a buscar la descripción del **vehículo** con
ese mismo código. Por eso a veces se lee un nombre de vehículo donde el título dice *Cliente*.
