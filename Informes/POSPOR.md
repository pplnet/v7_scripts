## Para qué sirve

**Las posiciones agrupadas por portfolio**, a una fecha. Es la vista de tenencia orientada a
cartera, y está **en inglés**: se usa para reportar a contrapartes o áreas que trabajan en ese
idioma.

## ⚠️ Es el tercer informe de posiciones — cuál usar

| Informe | Cuándo |
| --- | --- |
| **POSPOR** (éste) | agrupado por portfolio, rótulos en inglés |
| **POSI4** | posiciones y resultados de gestión, por vehículo y book |
| **POSICO** | lo mismo con criterio **contable** |

Los tres parten de `POSICIONES`, así que los totales tienen que cerrar entre sí **si se igualan los
filtros**. La causa habitual de que no cierren es el criterio de fecha, que arranca distinto en cada
uno.

## Los campos

| Campo | Detalle |
| --- | --- |
| **Date** | arranca en el día operativo |
| **Traded / Settled** | arranca en **Traded** (concertada) |
| **Codes** | apagado: agrega los códigos |
| **Portfolio** | **prendido** por defecto: agrupa por portfolio |
| **Mostrar lineas en 0** | apagado: esconde las posiciones en cero |
| **Mostrar Dummys** | apagado: esconde las posiciones dummy |
| **Especie** | acota a una especie; vacío es todas |

⚠️ **`Traded` contra `Settled` es la diferencia que más confunde** al comparar contra otro informe
de posiciones: son dos fotos distintas de la misma cartera.

## De dónde sale

De `POSICIONES`, con `OPERACIONES`, `BOPERACIONES`, `MOVPOSPEN` y `COTIZACIONES` para la valuación.
