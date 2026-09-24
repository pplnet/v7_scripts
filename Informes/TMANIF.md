## Para qué sirve

**Lista las manifestaciones de interés** de una licitación: qué ofertó cada cliente, a qué precio o
tasa, y qué se le terminó adjudicando.

Una manifestación es una **orden de tipo `TMANIF`**: la intención de un cliente de entrar en una
emisión antes de que se resuelva.

## Cuándo usarlo

- Ver las ofertas recibidas para una emisión en un rango de fechas.
- Revisar qué le quedó adjudicado a un cliente contra lo que había ofertado.
- Seguir en qué instancia está cada manifestación.

## Qué reporta, columna por columna

Una fila por manifestación, ordenada por número de orden.

| Columna | Qué es |
| --- | --- |
| Instancia | el nombre de la instancia en la que está, no su número |
| Nro Manifestacion | el número de orden |
| Fecha Operacion / Fecha Vencimiento | las fechas de la manifestación |
| Cliente - Razon Social | el cliente, con la razón social **recortada a 25 caracteres** |
| Nro Emision | la operación de emisión a la que apunta |
| Especie / Nombre especie | qué se ofertó |
| **Cantidad Ofertada** / **Precio-Tasa-Margen ofertado** | lo que pidió el cliente |
| **Cantidad Adjudicada** / **Precio-Tasa-Margen adjudicado** | lo que efectivamente se le dio |
| Tipo · C.Esp. · Vehiculo | la contraespecie y el vehículo |
| Fecha / Hora Carga · Fecha CargaSys | cuándo se cargó, y cuándo lo registró el sistema |

## Los filtros que confunden

| Campo | Qué hace de verdad |
| --- | --- |
| **F.Op. Desde** | obligatorio. Arranca **30 días atrás** |
| **F.Op. Hasta** | obligatorio. Arranca en el **día operativo** |
| **Vehiculo** | **obligatorio y precargado** con el vehículo por defecto del usuario. No hay opción "todos" |
| **Especie** | opcional. Vacío = todas |
| **Cliente** | opcional. Vacío = todos, y el encabezado lo dice |

🔴 **El vehículo no se puede dejar en blanco.** A diferencia de especie y cliente, acá vacío no
significa "todos": el informe exige uno y sólo trae ese. Dos personas con distinto vehículo por
defecto ven listados distintos sin haber tocado nada.

## ⚠️ Sólo muestra la instancia ACTIVA

Cruza contra `OPERACIONESBITS` pidiendo `Valor = '1'`. Una manifestación cuya instancia activa no
esté marcada **no aparece en el informe**, y no hay ninguna fila que lo avise.

## Relacionado

- **`MTMANI`** — cruza estas manifestaciones contra la emisión, para ver el matcheo.
