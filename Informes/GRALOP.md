## Para qué sirve

**Lista las operaciones de un período, con todos los filtros del negocio a mano.** Es el listado
general que se usa para buscar operaciones por cliente, especie, mercado, operador o instancia.

Cuando alguien pregunta "¿cómo busco las operaciones de tal cliente?" o "¿qué se operó esta
semana?", éste es el informe.

## Cómo acota

| Campo | Detalle |
| --- | --- |
| **Vehiculo** | **obligatorio**, y arranca precargado con el vehículo por defecto del usuario |
| **F.Op. Desde / Hasta** | obligatorias. Arrancan en **los últimos 30 días** hasta el día operativo |
| **F.Vto. Desde / Hasta** | obligatorias también. Van del día operativo hasta **un año adelante** |
| **Cliente / Especie / Mercado** | acotan; vacío es todos |
| **Tipos Op.** | multiselect contra `TIPOSOPERACION`; vacío es todos |
| **Instancias** | multiselect de las instancias de `OPERACIONES` — sirve para ver qué quedó trabado en una etapa |
| **Operador / Book / Tipos Neg.** | acotan; vacío es todos |
| **Pata pase** | prendido por defecto: incluye la contrapartida de los pases |
| **Operacion** | para ir directo a una operación puntual |

## ⚠️ Los dos rangos de fecha son obligatorios y filtran a la vez

Fecha de operación **y** fecha de vencimiento: los cuatro campos son obligatorios y ninguno se
puede dejar vacío para "no filtrar". Con los valores por defecto —operaciones de los últimos 30
días **que vencen dentro del próximo año**— una operación vieja o de vencimiento lejano no aparece
aunque esté en el rango de operación.

Es la causa habitual de "la operación existe pero el informe no la trae": suele ser el rango de
vencimiento, no el de operación.

## De dónde sale

De `OPERACIONES`, cruzada con `OPERACIONESBITS` e `INSTANCIAS` (para el estado en el circuito),
`TIPOSOPERACION` y `CLIENTES`.
