## Para qué sirve

**Mueve una operación de instancia**: apaga la instancia en la que estaba y prende la nueva. Es la
forma manual de hacer avanzar —o retroceder— una operación por su circuito de autorizaciones.

## Qué modifica

La tabla **`OPERACIONESBITS`**, que es donde vive el estado de instancia de cada operación: una fila
por instancia, con `Valor` en `'1'` si está activa y `'0'` si no.

## Los campos

| Campo | Qué pide |
| --- | --- |
| **# Operación** | el número de operación |
| **Inst. Anterior** | la instancia que hay que apagar. Arranca en **0** |
| **Inst. Nueva** | la instancia que hay que prender |

⚠️ **Los rótulos dicen «instancia» pero los campos del diálogo son numéricos de precio**
(`Precio1` y `Precio2`). Es sólo el nombre interno: lo que se carga es un número de instancia.

## 🔴 «Inst. Anterior = 0» apaga TODAS las instancias, no una

Es el default del campo, y es el comportamiento que sorprende:

| Inst. Anterior | Qué apaga |
| --- | --- |
| un número | **sólo** esa instancia |
| **0** (el default) | **todas** las instancias de esa operación |

Dejar el campo como viene y completar sólo la nueva deja la operación con **una sola** instancia
prendida. Muchas veces es lo que se quiere; cuando no, hay que cargar la anterior explícitamente.

## Si la instancia nueva no existe, la crea

Antes de prenderla, mira si hay fila para esa instancia en `OPERACIONESBITS`. Si no hay, llama a
**`INSBIT`** para insertarla y recién entonces la prende.

⚠️ Por eso funciona sobre una operación cuyo circuito no tiene esa instancia configurada: se la
inventa. El evento **no valida** que la instancia exista en `INSTANCIAS`.

## ⚠️ No valida la operación

El número de operación **no tiene validación**: con uno inexistente el evento corre igual, los
`UPDATE` no afectan ninguna fila y termina sin decir nada. No hay ningún mensaje de «esa operación
no existe».

## Relacionado

- **`INSBIT`** — inserta una fila de instancia en cero. Lo llama éste.
- **`INSTOPEEXT`** (función) — el avance y retroceso de instancia que usan las operaciones desde su
  propio circuito, con sus permisos y sus notificaciones. Este evento es la vía manual.
