## Para qué sirve

**Saca las operaciones de la instancia de emisión de boletos y las manda a la que sigue.** Recorre
todo lo que está en la instancia **67** y, según el tipo de operación y el estado de sus cuentas,
lo deriva.

Es un paso automático del circuito: no elige nada, procesa todo lo que encuentra.

## ⚠️ No tiene diálogo

Apenas se lo elige corre entero, sobre **todas** las operaciones en la instancia 67. No pregunta
cuáles ni cuántas son. El aviso que da el frontend antes de ejecutar un evento sin diálogo es la
única confirmación que hay.

## 🔴 A dónde las manda depende de si les FALTAN CUENTAS

Ésta es la bifurcación que más confunde, porque parece que el evento «se equivocó»:

| Estado | Va a la instancia |
| --- | --- |
| Tiene todas las cuentas | **10** — liquidación |
| **Le falta alguna cuenta** | **7** — vuelve a confirmación de operaciones |

Las cuentas que mira son `Cuenta1` a `Cuenta4`, y **sólo para los tipos de títulos**
(`TIC`, `TIV`, `TIFC`, `TIFV`, `TCOPRI`). Si además la operación tiene comisiones marcadas, exige
también `Cuenta5` y `Cuenta6`.

⚠️ **Una operación que "volvió para atrás" no es un error del evento**: es que le falta una cuenta
de liquidación. La única forma de saber cuál es abrir la operación y mirar.

## Las otras salidas

| Caso | Va a |
| --- | --- |
| La rueda está en la lista `RUECPC1` | **13** |
| Baja de oferta hacia el sistema externo (`TIC`/`TIV`/`TIFC`/`TIFV` marcadas) | **60** — informar al MAE |
| Instalación `MLASA` sin rueda especial | **68** — instancia intermedia de Raiden |

## Relacionado

- **`CBOINS`** — es el evento que efectivamente mueve cada operación de instancia. Éste sólo decide
  a cuál.
- **`00LIQU`** — la instancia 7, a donde vuelven las que tienen cuentas incompletas.
