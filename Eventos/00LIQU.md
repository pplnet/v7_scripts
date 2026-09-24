## Para qué sirve

**Confirma operaciones**: muestra las que están esperando confirmación, deja revisar y corregir sus
cuentas de liquidación, y a las que se marcan les deja la confirmación registrada y las hace avanzar
de instancia.

Es el paso previo a la liquidación: acá se chequea contra qué cuentas va a liquidar cada operación.

## Cómo se usa

1. Se abre con los filtros (o sin ninguno, que trae todo lo pendiente).
2. Aparece una **grilla con una columna `Confirma`**, que es un tilde.
3. Se revisan y, si hace falta, se corrigen las **cuentas editables** de cada fila.
4. Aceptar procesa **sólo las filas tildadas**.

🔴 **Nada arranca tildado.** Aceptar sin marcar nada no confirma ninguna operación y el evento
termina sin decirlo. Es el error más común: creer que confirma todo lo que trajo.

⚠️ **Cancelar la grilla cancela el evento entero**, incluso lo que se hubiera corregido en las
filas. No guarda nada parcial.

## Qué hace con cada operación tildada

| Paso | Qué escribe |
| --- | --- |
| Corrige las cuentas | `OPERACIONES` — sólo para ciertos tipos, ver abajo |
| Recalcula los movimientos | `ActualizarMovimientos3` |
| Registra la confirmación | una fila nueva en **`CONFIRMACIONESOP`**, con el contacto, las observaciones y el usuario |
| Avanza la instancia | de la **7** a la **10** |

⚠️ **La confirmación se NUMERA y se acumula**: cada corrida agrega una fila más a
`CONFIRMACIONESOP` con el número siguiente. Confirmar dos veces la misma operación deja dos
registros, no pisa el anterior.

## 🔴 La corrección de cuentas NO aplica a todos los tipos

El `UPDATE` de cuentas se saltea para los tipos de títulos y equity (`TIC`, `TIV`, `TIFC`, `TIFV`,
`TIDE`, `TIPO`, `TICO`, `TICT`, `TCOPRI`, `TCPCEM`, `TICF`, `TIVF`, `EQC`, `EQV`).

Consecuencia: en esas operaciones **se pueden editar las cuentas en la grilla y no se guardan**. La
confirmación se registra igual y la instancia avanza igual; lo único que se pierde es la edición, y
sin ningún aviso.

Los que sí guardan cuentas son los de moneda (`MMPF`, `MMPFCE` guardan mercados; `FXCF`, `FXVF`
guardan cuentas de cliente y de vehículo).

## Los filtros

| Campo | Qué hace de verdad |
| --- | --- |
| **Operacion** | opcional. Su búsqueda **sólo ofrece operaciones en instancia 7** |
| **Vehiculo** | **arranca precargado** con el del usuario, no en blanco |
| *Lo llamo desde la Operacion* | oculto. Cuando lo prende el circuito de la operación, **deja de filtrar por instancia 7** |

⚠️ Las operaciones de tipo `FXOCTC` y `FXOCTV` **nunca aparecen**: están excluidas de la consulta.

## Dos casos especiales

- **`MMCREM`**: en vez de avanzar de instancia, marca la operación como su propia cabecera y
  dispara `CBOINS` sobre cada operación que cuelgue de ella.
- **`FXCF` / `FXVF`** con moneda de neteo y sin boleto: además dispara `NUBNDF`.

## Relacionado

- **`CONFOP`** — la confirmación de **liquidación**, que es el paso siguiente.
- **`LIQ011`** — el neteo y la preliquidación.
- **`INSTAN`** — mover una operación de instancia a mano, si quedó fuera de la 7.
