## Para qué sirve

**Borra asientos contables de un rango de fechas** para poder volver a generarlos. Es el «deshacer»
de la contabilización, no una reversión: los asientos dejan de existir.

## 🔴 BORRA, no reversa

Elimina las filas de **`ASIENTOSCON`** y de **`ASIENTOSCON1`** (el detalle). No deja un asiento de
contrapartida ni una marca de anulado.

⚠️ **No pide confirmación y no muestra qué va a borrar antes de hacerlo.** Aceptar el diálogo
alcanza; sólo van saliendo mensajes *«Borrando Asientos Previos - Modelo …»* a medida que borra.

## 🔴 Sólo alcanza a los asientos que NO se exportaron

La consulta se queda con los que tienen el estado vacío, `COT` o `REV`. Un asiento ya enviado al
sistema contable **no se borra**, y no aparece ningún mensaje que lo diga: simplemente no entra en
la lista.

⚠️ Es la respuesta a *«corrí ANUASI y el asiento sigue ahí»*: ya se había exportado.

## Los filtros

| Campo | Qué hace de verdad |
| --- | --- |
| **D.Fecha** / **H.Fecha** | las dos arrancan en el **día operativo**, así que sin tocarlas borra lo de hoy |
| **Vehiculo** | arranca precargado con `VEHICON`. 🔴 Filtra por el vehículo **del modelo de asiento**, no por el de la operación |
| **Tipos de Asientos** | multiselect. Vacío = todos |
| **Operaciones** | multiselect. Vacío = todas |
| **Tipo** | `Sec`, `Fx Spot`, `Fx Fut`, `MM` o `Todos`. Arranca en **`Todos`** |

🔴 **Vacío significa TODOS en los tres multiselect.** Abrir el evento y aceptar sin tocar nada borra
**todos los asientos del día del vehículo por defecto**. Es el uso normal, pero conviene saberlo
antes de apretar.

⚠️ El filtro de vehículo compara contra la **lista** de vehículos del modelo de asiento — un modelo
puede valer para varios. Un asiento puede entrar aunque la operación sea de otro vehículo.

## Relacionado

- **`ASIBOL`** — genera los asientos. El par de éste.
- **`ANUOPE`** — la anulación de las operaciones.
