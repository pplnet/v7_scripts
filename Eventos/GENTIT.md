## Para qué sirve

**Convierte en operaciones las ofertas de títulos que llegaron del mercado.** Lee lo que dejó la
interfaz en `OPSIOPEL` y, por cada registro pendiente, da de alta la operación de títulos que
corresponde.

Es la puerta de entrada automática: lo que no pase por acá no existe como operación.

## 🔴 «Procesa» decide si guarda o si sólo muestra

Es el único campo del diálogo, y **arranca apagado**:

| Procesa | Qué hace |
| --- | --- |
| **apagado** (el default) | **arma la planilla del análisis y no escribe nada** |
| prendido | da de alta las operaciones de verdad |

⚠️ **Es una simulación por defecto.** Corriéndolo y mirando la planilla no se creó ninguna
operación, aunque la columna de resultado diga que están bien.

💡 Y por eso es la forma de revisar antes: primero apagado para ver qué va a pasar con cada oferta,
después prendido.

## Qué ofertas toma

Sólo las de `OPSIOPEL` que cumplen **todas** estas condiciones:

| Condición | Detalle |
| --- | --- |
| Tipo de registro | `0105` o `0205` |
| Tipo de negocio | los de la variable `TIPONEGTIT` |
| Rueda | **NO** las de `RUELICI`, `RUECORR` ni `RUECPC1` |
| **Fecha** | **la del día operativo, y nada más** |
| Carga | vacía |
| Procesado | `0` |

🔴 **La fecha es fija: hoy.** No hay filtro. Una oferta de ayer que quedó sin procesar **no la toma
nunca más** — este evento no la va a levantar aunque se corra mil veces.

⚠️ Las ruedas excluidas no son un olvido: las de licitación, corredores y CPC1 las procesa
**`GENORD`**. Una oferta que «no aparece» puede estar yendo por ese otro camino.

## Qué hace con cada oferta

1. Si la **especie no existe**, la da de alta con `ALTESP`, usando el código y el mnemotécnico del
   mercado y el número de cupón que vino.
2. Arma y graba la operación.
3. La modifica para que se recalculen sus movimientos.
4. La deja en la instancia que corresponda.

## 🔴 Una especie sancionada manda la operación a la instancia 9

Si la especie está marcada como sancionada, la operación se crea igual pero **queda en la instancia
9 — compliance** en vez de seguir el circuito normal, y la planilla lo muestra como *«A inst 9»*.

⚠️ **No es un error ni un rechazo**: la operación existe y está esperando una revisión. Quien la
busque en el circuito habitual no la va a encontrar.

⚠️ Una especie dada de alta por este evento nace **deshabilitada** (`DES`). Si el mensaje habla de
una especie en ese estado, es una que se creó recién.

## Relacionado

- **`GENORD`** — el mismo trabajo para las ruedas de licitación, corredores y CPC1.
- **`ALTESP`** — el alta de especie que este evento dispara cuando hace falta.
- **`EMIBOL`** — el paso siguiente del circuito, una vez emitido el boleto.
