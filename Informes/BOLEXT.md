## Para qué sirve

**Imprime el boleto de una operación** — el comprobante que se le entrega al cliente. Es el boleto
**general**: acepta más tipos de operación que BOLCPC y no exige que sea de mercado regulado.

Es el informe que más gente distinta usa del sistema.

## ⚠️ No confundir con BOLCPC

| | Tipos de operación | Alcance |
| --- | --- | --- |
| **BOLEXT** (éste) | `TIC`, `TIV`, `TIFC`, `TIFV`, `TCOPRI` | todas |
| **BOLCPC** | `TIC`, `TIV` | sólo rueda garantizada (mercado regulado) y las propias |

Ante la duda, **éste** es el que cubre más casos. BOLCPC existe para el boleto específico de rueda
garantizada.

## Los campos

| Campo | Qué hace |
| --- | --- |
| **NrOperacion** | la operación a imprimir. El buscador ya viene recortado a los tipos que acepta |
| **Leyenda** | texto libre que sale impreso en el boleto |
| **Salida** | Impresora, Pantalla, PDF o Mail. Por defecto **Impresora** |

⚠️ **La salida arranca en Impresora.** Quien sólo quiere verlo en pantalla tiene que cambiarla, o
manda a imprimir sin querer.

## Qué sale en el boleto

Los datos del agente (matrícula CNV, CUIT, número de agente A3 Mercados, condición de IVA e
Ingresos Brutos), los del cliente, el detalle de la operación y —cuando corresponde— la leyenda
fiscal con el tipo de cambio aplicado. Sale de `OPERACIONES`, `BOPERACIONES`, `CLIENTES`, `ORDENES`
y `LIBORDENES`.
