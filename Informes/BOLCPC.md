## Para qué sirve

**Imprime el boleto de una operación de rueda garantizada** — el comprobante que se le entrega al
cliente por una compra o una venta hecha en mercado regulado.

## ⚠️ No confundir con BOLEXT

Son dos scripts de boleto y la diferencia es **qué operaciones acepta cada uno**:

| | Tipos de operación | Alcance |
| --- | --- | --- |
| **BOLCPC** (éste) | `TIC`, `TIV` | sólo las de **mercado regulado**, más las propias del vehículo |
| **BOLEXT** | `TIC`, `TIV`, `TIFC`, `TIFV`, `TCOPRI` | todas, sin el filtro de regulado |

Si el número de operación que alguien busca **no aparece en el buscador de este informe**, casi
siempre es porque la operación no es de rueda garantizada: va por **BOLEXT**.

El recorte exacto: la operación tiene que tener la marca `Merc.Regulado` prendida, o bien ser una
operación cuyo cliente es el propio vehículo (operación propia).

## Los campos

| Campo | Qué hace |
| --- | --- |
| **NrOperacion** | la operación a imprimir. El buscador ya viene recortado a las que califican |
| **Leyenda** | texto libre que sale impreso en el boleto |
| **Salida** | Impresora, Pantalla, PDF o Mail. Por defecto **Impresora** |

⚠️ **La salida arranca en Impresora.** Quien sólo quiere mirarlo tiene que cambiarla a Pantalla, o
manda a imprimir sin querer.

## Qué sale en el boleto

Los datos del agente (matrícula CNV, CUIT, número de agente, condición de IVA e Ingresos Brutos),
los del cliente, y el detalle de la operación con sus ejecuciones. Sale de `OPERACIONES`,
`BOPERACIONES`, `CLIENTES`, `ORDENES` y `EJECUCIONES`.
