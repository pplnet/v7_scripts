## Para qué sirve

**Muestra qué tiene cada cliente en custodia a una fecha**: el saldo por especie y por cuenta, con
su valor nominal, su valor residual y las dos valuaciones —la de mercado y la de valor técnico—.

Es el informe de custodia que responde *"¿qué títulos tenemos guardados de este cliente?"* y
*"¿cuánto valen?"*.

## Cuándo usarlo

- Ver la custodia de un cliente o de un grupo de clientes a una fecha.
- Separar lo que está libre de lo que está afectado a algo (por estado de custodia).
- Comparar la valuación de mercado contra la de valor técnico.

## Qué reporta, columna por columna

| Columna | Qué es |
| --- | --- |
| Especie | qué instrumento es |
| Ubic. | el mercado donde está depositado |
| CodCliente / Nombre Cliente | de quién es |
| Cuenta / Nombre | la cuenta de custodia |
| **Estado** | el estado de custodia: libre, prendado, cauciondo… |
| **V.N.** | valor nominal — lo que figura |
| **V.R.** | valor residual — lo que queda sin amortizar |
| **Valuacion** | a precio de mercado |
| Valor Tecnico / **Valuacion V. T.** | la otra valuación, la técnica |

## Los filtros que confunden

| Campo | Qué hace de verdad |
| --- | --- |
| **Vehiculo** | **obligatorio y precargado** con el del usuario. No hay opción "todos" |
| **Fecha** | obligatoria, arranca en el día operativo y **no puede ser futura** |
| **Ubicacion** | opcional, pero si se carga tiene que ser un mercado que exista |
| **Tipo Cliente** | arranca en **`Todos`**. Las otras dos opciones acotan a clientes propios o a los de la caja de valores |
| **Moneda** | arranca en **Pesos** |
| **Estados** | multiselect. Vacío = todos los estados |
| **Clientes** | multiselect, y **su lista depende de «Tipo Cliente»** |
| **Especies** / **Excluye Especies** | dos listas: una incluye, la otra saca. Vacías = todas |
| **Otro programa** | apagado por defecto |

🔴 **«Tipo Cliente» filtra DOS cosas a la vez.** Además de acotar el informe, cambia **qué clientes
ofrece la lista de abajo**. Eligiendo clientes primero y cambiando el tipo después, la selección
puede quedar apuntando a clientes que el filtro nuevo ya no deja pasar — y el informe sale vacío sin
decir por qué.

⚠️ **«Especies» y «Excluye Especies» se aplican las dos.** Cargar la misma especie en las dos listas
no da error: no sale nada.

## 🔴 La fecha busca el ÚLTIMO saldo hasta esa fecha, no el de ese día

Por cada combinación de cliente, especie y cuenta toma la **máxima fecha de saldo menor o igual** a
la pedida. Una especie sin movimiento en meses aparece igual, con el saldo de la última vez que se
movió.

Es lo que se quiere —una custodia no desaparece porque ese día no pasó nada— pero explica por qué el
informe no cuadra contra un corte de movimientos del día.

## ⚠️ Dos saldos quedan afuera a propósito

La consulta excluye los números de saldo **121** y **227**, y sólo considera el 101 y los mayores a
201. Un saldo cargado fuera de ese rango **no aparece en el informe**, y no hay ninguna fila que lo
avise.

## Relacionado

El estado de custodia sale de `ESTADOSCUSTODIA`; la lista del diálogo muestra el de libre
disponibilidad (`SALLIBRECU`) más los deshabilitados.
