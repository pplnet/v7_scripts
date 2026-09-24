## Para qué sirve

**Cruza cada emisión con las manifestaciones de interés que recibió.** Por cada emisión muestra qué
se adjudicó y, debajo, la lista de clientes que ofertaron con su cantidad y su precio.

Es la vista de licitación completa: la emisión arriba, sus ofertas abajo.

## Cuándo usarlo

- Ver cómo quedó resuelta una licitación: qué se adjudicó y quiénes participaron.
- Revisar las ofertas de una emisión puntual.
- Comparar lo ofertado contra lo adjudicado, cliente por cliente.

## Qué reporta

**Dos niveles, uno adentro del otro.**

### Por cada emisión

| Columna | Qué es |
| --- | --- |
| Especie | el código y el nombre |
| **Tipo** | contra qué se ofertó: `Precio`, `Tasa` o `Margen Diferencial` |
| Nro Emision | la operación de emisión |
| **Estado** | `Pendiente`, `Cerrada` o `Desierta` |
| Cantidad Adjudicada / Pr-Tasa-Marg.Dif | lo que se terminó colocando |
| Emisor | recortado a 25 caracteres |
| Rueda | la unidad de negocio |

### Y debajo, sus manifestaciones

Fecha, cumplimiento, tipo de cliente, número de manifestación, cliente, **cantidad ofertada**, tipo,
**precio/tasa/margen ofertado**, monto y estado.

## Los filtros

| Campo | Qué hace de verdad |
| --- | --- |
| **F.Op. Desde** | obligatorio. Arranca **30 días atrás** |
| **F.Op. Hasta** | obligatorio. Arranca en el **día operativo** |
| **Emision** | opcional. Vacío = **todas** las del rango, y el encabezado lo dice |

⚠️ **El campo Emision sólo ofrece operaciones de tipo `TCPCEM`.** Es el único tipo que este informe
entiende como emisión; una colocación cargada con otro tipo no aparece.

## 🔴 Las fechas son de la EMISIÓN, no de las manifestaciones

El rango filtra la fecha de operación de la **emisión**. Las manifestaciones se traen todas las de
esa emisión, **sin importar cuándo se cargaron**.

Consecuencia: una manifestación de hace dos meses aparece igual si su emisión cae en el rango — y
una de ayer no aparece si su emisión no cae. Es lo contrario de lo que hace **`TMANIF`**, que filtra
por la fecha de la manifestación.

## Relacionado

- **`TMANIF`** — la lista plana de manifestaciones, filtrada por la fecha de **ellas** y por
  vehículo. Si los dos informes muestran conjuntos distintos, casi siempre es por esto.
