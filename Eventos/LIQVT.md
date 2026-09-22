## Para qué sirve

**Registra la liquidación de una transacción VT** en la tabla de liquidaciones. Toma una
transacción y le arma su fila de liquidación a partir de lo que se ejecutó.

## Qué modifica

Inserta en `LIQUIDACIONESVT`, leyendo de `TRANSACCIONES2` y `MOVEJECUTADOS`. **Es una escritura
directa**, sin confirmación posterior.

## Los campos

| Campo | Qué hace |
| --- | --- |
| **NrTrans** | la transacción a liquidar. Es el único dato que pide |

⚠️ **El campo no valida nada**: no exige que la transacción exista ni que esté en condiciones. Con
un número equivocado el evento corre igual y simplemente no encuentra qué insertar — sin avisar que
el número estaba mal.
