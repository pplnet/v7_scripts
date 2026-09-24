## Para qué sirve

**Confirma la liquidación**: toma las preliquidaciones pendientes, deja elegir cuáles autorizar y,
por cada una, confirma la custodia y hace avanzar la operación a la instancia **70** — la de
liquidada.

Es el último paso del circuito de liquidación.

## Cómo se usa

1. Se eligen la fecha de liquidación y los filtros.
2. Aparece la grilla **«Seleccione las Operaciones a Autorizar»** con una columna **`Autoriza`**,
   que es un tilde.
3. Aceptar procesa **sólo las filas tildadas**.

🔴 **Nada arranca tildado.** Aceptar sin marcar no confirma nada y el evento termina sin decirlo.

⚠️ Si no hay nada para confirmar, corta con *«No Existen liquidaciones para confirmar
especificaciones»* antes de mostrar la grilla.

⚠️ Las columnas **Cta.Cliente** y **Cta.Vehiculo** vienen en gris: están para **revisar**, no para
corregir. Si están mal, hay que arreglarlas antes, en la confirmación de operaciones.

## Qué hace con cada operación tildada

| Paso | Qué pasa |
| --- | --- |
| Confirma la custodia | dispara **`CONCUS`** |
| Genera el comprobante | dispara **`03CONF`** |
| Avanza la instancia | de la **10** a la **70** |

## 🔴 La instancia NO avanza siempre, y no lo avisa

El paso a la 70 tiene **dos condiciones** que se chequean operación por operación:

1. Que **ninguna otra transacción** de la misma operación siga en instancia 14.
2. Que la operación **no tenga movimientos pendientes** (`MOVPENDIENTES`).

Si alguna no se cumple, la custodia se confirma y el comprobante se genera **igual**, pero la
operación se queda en la 10. No hay ningún mensaje.

⚠️ Es la causa habitual de *«la confirmé y sigue sin liquidar»*: casi siempre es una transacción
hermana sin confirmar, o un movimiento pendiente.

## Los filtros

| Campo | Qué hace de verdad |
| --- | --- |
| **Fecha Liq.** | obligatoria, arranca en el día operativo |
| **Vehiculo** | **arranca precargado** con el del usuario |
| Cliente · Especie · Mercado · Cuenta | opcionales |
| **Manual** | **arranca prendido**. Apagarlo muestra los campos de referencia y de transacción para confirmar una puntual |
| *NrOperacionRef4* · *NrTrans* | aparecen **sólo con «Manual» apagado**, y ahí se usan para ir a una liquidación concreta |
| *Interfase* | oculto, para cuando lo llama otro proceso |

⚠️ **«Manual» prendido significa el modo normal** (elegir de la grilla). El rótulo sugiere lo
contrario: apagarlo es lo que habilita cargar los números a mano.

## Relacionado

- **`00LIQU`** — confirma las operaciones (instancia 7 → 10).
- **`LIQ011`** — netea y preliquida.
- **`CONCUS`** y **`03CONF`** — los dos eventos que este dispara por cada fila.
