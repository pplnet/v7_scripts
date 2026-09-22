## Para qué sirve

**Muestra en qué estado del circuito está cada operación.** Es el informe para responder "¿esto ya
se liquidó?", "¿qué quedó trabado?" y "¿por dónde va esta operación?".

## Cuándo usarlo

- Ver qué operaciones de un día quedaron pendientes en alguna etapa.
- Seguir una operación puntual por el circuito.
- Controlar el estado por mercado, por clase de operación o por tipo de negocio.

## Hay un WebView con el mismo nombre

Existe un **WebView `ESTOPE`** que muestra lo mismo en pantalla y **se refresca solo** cuando alguien
da de alta, edita, borra, avanza o retrocede una operación. Para mirar el estado en vivo conviene
ése; este informe sirve para sacarlo impreso o exportarlo.

## Cómo acota

| Campo | Detalle |
| --- | --- |
| **D./H. Concert.** | rango de fecha de concertación, **obligatorio**. Arranca en el día operativo (desde y hasta el mismo día) |
| **Vehiculo** | arranca precargado con el vehículo por defecto del usuario |
| **ClaseOp.** | multiselect de clases de operación |
| **Tipos Op.** | 🔴 **depende de ClaseOp.**: si hay una clase elegida, sólo se ofrecen los tipos de esa clase |
| **Operacion / Especie / Mercado / Tipos Neg.** | acotan; vacío es todos |

⚠️ **El rango de concertación arranca en un solo día** (hoy, desde y hasta). Una operación
concertada ayer no aparece hasta que se corra la fecha "desde".

⚠️ **La cascada de ClaseOp. a Tipos Op. sorprende**: al elegir una clase, los tipos ya
seleccionados que no pertenecen a esa clase dejan de estar disponibles.

## De dónde sale

De `OPERACIONES` cruzada con `OPERACIONESBITS` (el estado en el circuito), `TIPOSOPERACION` y
`TIPOSNEGOCIO`.
