## Para qué sirve

**Convierte la TNA de cada cupón en el porcentaje de renta del período.** Recorre la agenda de
cupones de una especie y, para cada uno, calcula qué porcentaje corresponde a los días que dura ese
cupón.

Es lo que hay que correr cuando la agenda tiene la tasa nominal anual cargada pero no el porcentaje
de renta.

## 🔴 «Procesa» decide si guarda o si sólo muestra

Es el campo que define todo el comportamiento, y **arranca apagado**:

| Procesa | Qué hace |
| --- | --- |
| **apagado** (el default) | **muestra la planilla del cálculo y no toca nada** |
| prendido | escribe `PorRenta` en `AGENDACUPONES` |

⚠️ **Es una simulación por defecto.** Quien corra el evento, mire los números y cierre, no cambió
nada — aunque la planilla muestre la columna *% Renta Cal* llena. Para que rija hay que volver a
correrlo con el campo tildado.

💡 Y al revés: es la forma de **revisar antes de escribir**. Primero apagado para ver, después
prendido.

## Qué muestra la planilla

Arriba, los datos de la especie: base de días, moneda de emisión, criterio de devengamiento y contra
qué fecha se calcula. Abajo, una fila por cupón:

| Columna | Qué es |
| --- | --- |
| NrCupon | el número |
| Fecha / Fecha Ant | los dos extremos del período |
| **Plazo** | los días entre ambas |
| **Base** | 360, 365 o los días reales del año, según la especie |
| **Indice** | `Plazo / Base` — el factor de conversión |
| TNA | lo que hay cargado |
| **% Renta base** | lo que hay hoy en la agenda |
| **% Renta Cal** | lo que quedaría: `TNA × Indice` |

💡 Comparar *% Renta base* contra *% Renta Cal* es la forma de ver qué cupones van a cambiar.

## 🔴 Qué fecha usa depende del criterio de la especie

El campo `DevengaTasa` de la especie decide contra qué fecha se mide cada cupón:

| DevengaTasa | Usa |
| --- | --- |
| `COR` | fecha de corte |
| `PAG` | fecha de pago |
| cualquier otra | **fecha de pago original** — es el default |

⚠️ Cambiar ese criterio en la especie cambia **todos** los plazos y, con ellos, todos los
porcentajes. Si los números no son los esperados, eso es lo primero a mirar.

⚠️ **El cupón 1 mide contra la fecha de emisión de la especie**, no contra un cupón anterior que no
existe.

## El filtro

| Campo | Qué pide |
| --- | --- |
| **Especie** | obligatoria. Sólo acepta una que **descienda de TÍTULO**, que **no sea un cupón** y que esté habilitada |

## Relacionado

- **`AGECUP`** — genera la agenda de cupones. Este evento la completa.
