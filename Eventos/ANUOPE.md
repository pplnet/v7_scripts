## Para qué sirve

**Borra de la base las operaciones que quedaron anuladas.** Recorre las que tienen la instancia
**30** activa —la de anulación— y las elimina de `OPERACIONES`.

Es la limpieza de lo que se anuló: mientras no corra, las operaciones anuladas siguen en la tabla.

## 🔴 BORRA de verdad, no marca

Es un `DELETE` sobre `OPERACIONES`. No hay una instancia «borrada» ni una marca de baja lógica: la
fila deja de existir.

⚠️ **No tiene diálogo.** Apenas se lo elige en el menú corre entero, sobre **todas** las operaciones
en instancia 30. No pregunta cuáles ni cuántas son. El frontend avisa antes de ejecutar un evento
sin diálogo — ese cartel es la única confirmación que hay.

## 🔴 Si la variable `BORRAOPAUT` no dice `SI`, el evento NO HACE NADA

Todo el script está adentro de ese `if`. Con la variable en cualquier otro valor —o sin cargar— el
evento corre, termina bien y **no borra ni informa nada**.

⚠️ **No hay ningún mensaje que lo diga.** Desde afuera se ve igual que «no había nada para borrar».
Si alguien reporta que las operaciones anuladas no se van, eso es lo primero que hay que mirar.

## Una operación liquidada no se borra, y sólo queda un mensaje

El borrado va adentro de un `try`. Si la base lo rechaza —típicamente porque la operación ya está
liquidada y algo la referencia— se muestra *«Se está intentando eliminar una operacion liquidada»*
y **el evento sigue con la siguiente**.

⚠️ No corta, no acumula un resumen y no deja la lista de las que no pudo borrar: hay que leer los
mensajes a medida que salen.

## Con sistema externo, primero avisa y después borra

En las instalaciones integradas a un sistema externo de operaciones (MAE / Raiden), las operaciones
de tipo **TIC** y **TIV** no se borran directo: primero se le informa la baja o el rechazo al
sistema externo, y **sólo si contesta OK** se ejecuta el `DELETE`.

| Situación | Qué informa |
| --- | --- |
| El externo pidió la baja | la confirmación de esa baja |
| Se rechazó a mano | el rechazo, con el detalle de las excepciones de la operación |
| Baja propia hacia el externo | la cancelación |
| La operación no tiene número externo | nada: se borra directo |

⚠️ **Si el externo no contesta OK, la operación NO se borra** y queda en instancia 30 para la
corrida siguiente. Es la dirección correcta —no se puede borrar de un lado y no del otro— pero
significa que una operación puede quedar dando vueltas varias corridas sin que nadie lo note.

## Relacionado

- **`ANUASI`** — la anulación de los asientos.
- **`INSTAN`** — mueve una operación de instancia a mano; es la forma de llevar una a la 30, o de
  sacarla.
