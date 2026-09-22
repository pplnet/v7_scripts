## Para qué sirve

**Genera las dos patas de un pase.** A partir de la operación de pase (`TIPA` o `TIPP`) crea las
operaciones que la componen, con todo lo que cuelga de ellas: bits de instancia, movimientos de
límites, cashflow y pendientes.

## ⚠️ "Procesa" NO decide si procesa — el nombre engaña

La tilde **`Procesa`** controla si el evento corre **desatendido o interactivo**:

| `Procesa` | Qué cambia |
| --- | --- |
| **apagado** (por defecto) | muestra la hoja del informe y los errores salen como **cartel modal** |
| prendido | no muestra nada y los errores salen como mensaje al pie |

En los dos casos **genera las patas igual**. Prendido es el modo pensado para que lo llame otro
proceso, no para usarlo a mano.

## Si algo falla, reversa lo que creó

Cuando la generación no se completa, el script **borra las operaciones que acaba de crear** y sus
filas en `OPERACIONESBITS`, `MOVLIMITES`, `MOVCASHFLOW`, `MOVPENDIENTES` y `EXCEPCIONES`.

⚠️ Eso es un rollback acotado a las patas nuevas — **no toca la operación de pase original** ni
ninguna operación preexistente.

## Los campos

| Campo | Qué hace |
| --- | --- |
| **Operacion** | el pase a procesar. Obligatorio, y el buscador sólo muestra `TIPA` y `TIPP` |
| **Procesa** | modo desatendido. Ver arriba |

⚠️ **Si el número no aparece en el buscador, la operación no es un pase.** Ese filtro es por tipo
de operación y no se puede saltear desde la pantalla.
