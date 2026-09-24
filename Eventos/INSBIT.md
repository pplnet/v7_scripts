## Para qué sirve

**Crea una instancia para una operación**: inserta la fila en `OPERACIONESBITS` con el valor en
`'0'`, o sea la instancia existe pero está apagada.

## Cuándo usarlo

Casi nunca a mano. **Lo llama `INSTAN`** cuando hay que mover una operación a una instancia que
todavía no tiene fila. Se corre suelto sólo para preparar una instancia sin activarla.

## Los campos

| Campo | Qué pide |
| --- | --- |
| **NrBit** | el número de instancia |
| **Operacion** | el número de operación |

⚠️ **Ninguno de los dos se valida.** Ni que la operación exista, ni que la instancia esté
configurada en `INSTANCIAS`, ni que ya haya una fila igual.

## 🔴 Siempre inserta en CERO

No prende nada: la fila nace apagada. Para activar la instancia hay que usar **`INSTAN`**.

⚠️ Corriéndolo dos veces sobre la misma operación e instancia se intenta insertar la fila de nuevo.
Lo que pase ahí lo decide la clave de la tabla, no el evento — que no chequea nada antes.

## Relacionado

- **`INSTAN`** — mueve la operación de instancia, y llama a éste si le falta la fila.
