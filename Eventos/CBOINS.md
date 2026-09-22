## Para qué sirve

**Mueve una operación de una instancia a otra, a mano.** Es la herramienta de corrección que se usa
cuando una operación quedó trabada en una instancia del circuito y hay que sacarla de ahí sin pasar
por el avance normal.

Es el script más ejecutado del sistema.

## ⚠️ Escribe directo en la base, salteando el circuito

No es un "avanzar" ni un "retroceder": apaga el bit de la instancia donde está la operación y
prende el de la instancia destino, con `UPDATE` e `INSERT` directos sobre `OPERACIONESBITS`. **No
corre ninguna validación del circuito ni dispara lo que dispararía un avance normal.**

Por eso es una herramienta de corrección, no de operación diaria. Si alguien pregunta cómo avanzar
una operación en el día a día, la respuesta no es ésta.

## Qué hace, paso a paso

1. Apaga la instancia de origen (`NrInstDesde`).
2. Prende la instancia destino (`NrInstHacia`); si esa fila no existe, la crea.
3. Si la tabla elegida es `OPERAC`, además graba la **dirección** en `OPERACIONES`.
4. Deja registro en `INSTANCIASOP` con el usuario, la instancia y la leyenda
   *"Evento CBOINS mueve a N"*.

## Los campos

| Campo | Qué hace |
| --- | --- |
| **Nro. Op./Orden** | la operación a mover. Obligatorio |
| **Tabla** (`OPERAC` / `ORDEN`) | con `OPERAC` además actualiza la dirección en `OPERACIONES`. El movimiento de instancia se graba igual en las dos |
| **Direcc** (`0NULL` / `1RETRO` / `2AVANZ`) | qué dirección queda marcada. **Sólo tiene efecto con `OPERAC`** |
| **NrInstDesde** | de dónde sale. 🔴 **Con 0 apaga TODAS las instancias de esa operación**, no una |
| **NrInstHacia** | a dónde va. No puede ser 0 |

## ⚠️ Lo que hay que saber antes de usarlo

- **`NrInstDesde = 0` borra todas las marcas de instancia de la operación.** El campo lo acepta
  (valida `>= 0`), así que es fácil de escribir sin querer.
- **No verifica que la operación exista.** Con un número mal tipeado no falla: no encuentra nada
  que actualizar y crea la fila de la instancia destino igual.
- **No hay deshacer.** Lo único que queda es el registro en `INSTANCIASOP`, que dice a dónde se
  movió pero no de dónde venía si se usó el 0.
