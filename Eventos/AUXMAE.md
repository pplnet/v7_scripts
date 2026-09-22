## Para qué sirve

**Reparte las operaciones de títulos por el circuito del MAE.** Toma todas las operaciones que
están esperando en ese punto y las manda a la instancia que les corresponde según qué son.

## 🔴 No pide nada y procesa TODO de una

Este evento **no tiene diálogo**: se ejecuta apenas se lo elige, sin preguntar nada y sin
confirmación. No procesa una operación — procesa **todas** las que estén en la instancia de espera
(el bit 50), en una sola corrida.

Por eso al ejecutarlo desde el menú aparece el cartel *"El evento que seleccionó no posee diálogo,
¿Desea ejecutarlo?"*. Ese cartel es la única chance de frenarlo.

## Cómo reparte

| La operación es… | Va a la instancia |
| --- | --- |
| una **venta** de títulos | Informar al MAE |
| una **compra** con cliente que **no** es agente del MAE | Informar al MAE |
| el resto de las compras | Confirmar del MAE |
| de una especie **que no se negocia en el MAE** | Agregar Nro. Boleto, y de ahí a Terminal |

## Qué modifica

Escribe directo en la base: mueve las instancias en `OPERACIONESBITS`, actualiza `OPERACIONES` y
registra excepciones en `EXCEPCIONES`. **No hay deshacer.**

⚠️ Como corre sobre todo lo que encuentre, el resultado depende de qué había pendiente en ese
momento. Dos corridas seguidas no hacen lo mismo: la segunda ya no encuentra lo que movió la
primera.
