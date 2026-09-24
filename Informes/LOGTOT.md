## Para qué sirve

**Muestra quién cambió qué en la configuración del sistema**: altas, modificaciones y bajas sobre
informes, eventos, fórmulas, variables, perfiles, modelos de asiento y demás tablas de definición,
con el valor anterior y el nuevo.

Es el informe para responder *"¿quién tocó esto y cuándo?"* y *"¿qué tenía antes?"*.

## Cuándo usarlo

- Rastrear un cambio de configuración que rompió algo.
- Ver el historial de una variable del sistema o de un perfil.
- Revisar qué se modificó en una fecha.

## De dónde sale

De la tabla **`PMAUDIT`**, que es la auditoría de cambios. **No audita datos de negocio**:
operaciones, clientes y posiciones no están acá.

## Qué reporta

| Columna | Qué es |
| --- | --- |
| Operador | quién lo hizo |
| Fecha | cuándo |
| Accion | `A` alta · `M` modificación · `B` baja |
| Tabla / Codigo | qué se tocó |
| **Campo** | qué campo cambió |
| **Valor Anterior** / **Valor Actual** | el antes y el después |

## 🔴 «Resumido» cambia el informe por completo

| Resumido | Qué muestra |
| --- | --- |
| **apagado** (el default) | una fila por **campo** cambiado, con el antes y el después |
| prendido | una fila por **objeto** tocado, con su nombre — sin ningún detalle de qué cambió |

⚠️ En modo resumido, un objeto que ya no existe sale con el nombre **`BAJA`**. No es un valor del
log: es que el informe fue a buscar su nombre y no lo encontró.

## Dos listas de tablas, y no hacen lo mismo

| Campo | Para qué |
| --- | --- |
| **Tabla** | una sola, escrita a mano. Si se carga, manda sobre las listas |
| **Tablas:** | multiselect de las tablas más usadas |
| *Todas_las_tablas* | oculto. Es el universo completo, y es lo que rige si no se elige nada |

⚠️ Dejar todo vacío **no trae todo lo de `PMAUDIT`**: trae lo de esa lista completa, que son unas
treinta tablas de configuración. Una tabla que no esté ahí no aparece.

## ⚠️ Las modificaciones que no cambiaron nada se esconden

Una fila de auditoría cuyo valor anterior y actual son iguales **no se imprime**. Pasa cuando
alguien abre una definición y la guarda sin tocarla: el log la registró, el informe no la muestra.

## ⚠️ Algunas variables están excluidas a propósito

Filtrando por la tabla `VARIABLES`, el informe saca las que estén en la lista `VARNOLOG`. Son
variables que cambian todo el tiempo y ensuciarían el informe; si una variable «no tiene historial»,
puede estar ahí.

## Los filtros

| Campo | Detalle |
| --- | --- |
| **Desde** / **Hasta** | obligatorias, arrancan en el **día operativo**. Hasta incluye el día completo |
| **Codigo** | busca **por el comienzo**: `POS` trae `POSI4`, `POSICO`, `POSPOR`… |
| **Campo** | exacto, no por comienzo |
| **Usuario** | exacto |
