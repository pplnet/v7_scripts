## Para qué sirve

**Autoriza las excepciones de una operación**, dejando registrado quién las autorizó. Es lo que
destraba una operación que quedó frenada por un control —un límite, un vencimiento, un dato fuera de
regla— y necesita el visto bueno de alguien.

## Qué modifica

La columna `Autorizado` de la tabla **`EXCEPCIONES`**, con el usuario que corre el evento.

## Los campos

| Campo | Qué pide |
| --- | --- |
| **Operacion** | el número de operación. **Obligatorio** |
| **Excepcion** | qué tipos de excepción autorizar. **Vacío = todas las de esa operación** |

⚠️ **El campo Excepcion admite VARIOS tipos**, separados por `|` (por ejemplo `VOLOPE\|CANOPE`). No
es un solo valor.

## 🔴 No re-autoriza lo ya autorizado

El `UPDATE` sólo alcanza a las excepciones con `Autorizado` en nulo. Una excepción que ya tiene
autorización **queda como está**, aunque se vuelva a correr el evento con otro usuario.

Consecuencia práctica: **correrlo dos veces no cambia nada la segunda vez**, y no lo avisa.

## ⚠️ El texto autorizado puede arrastrar el de otra excepción

El evento lee las excepciones de la operación, arma el texto con **la última que leyó** más el
usuario, y escribe ese mismo texto en todas las que estaban sin autorizar.

Si la operación tiene excepciones **ya autorizadas por otra persona**, esa última lectura puede caer
sobre una de ellas — y el nombre de quien autorizó antes termina adentro del texto de la
autorización nueva.

En el caso normal (todas las excepciones sin autorizar) no pasa: queda sólo el usuario actual.
Acotando con el campo **Excepcion** al tipo que se quiere autorizar, tampoco.

## Relacionado

Las excepciones las generan los controles de las operaciones (la sección `CONDICIONES` de cada tipo
de operación). Este evento no las crea ni las borra: sólo las marca.
