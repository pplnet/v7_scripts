## Para qué sirve

**Asigna el número de boleto a una operación.** Es el paso que le pone el número oficial al boleto
antes de imprimirlo.

## Qué modifica

Escribe el número asignado en la tabla `OPERACIONES`. **Es una escritura directa**: no hay
confirmación posterior ni forma de deshacerlo desde la pantalla.

## Los campos

| Campo | Qué hace |
| --- | --- |
| **Tipo** (`Minor` / `Mayor`) | arranca en **Mayor** |
| **Nro.Oper.May.** | la operación mayorista. **Obligatorio sólo con `Mayor`**; con `Minor` queda deshabilitado y no se pide |

⚠️ **El campo de operación aparece y desaparece según el tipo.** Con `Minor` el diálogo queda con un
solo campo, y quien esperaba cargar un número puede pensar que la pantalla se rompió.
