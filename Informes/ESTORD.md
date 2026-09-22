## Para qué sirve

**Muestra en qué estado está cada orden.** El equivalente de ESTOPE pero para órdenes: qué se
ejecutó, qué está pendiente y qué quedó trabado.

## Hay un WebView con el mismo nombre

Existe un **WebView `ESTORD`** que muestra lo mismo en pantalla. Para mirar el estado en vivo
conviene ése; este informe sirve para imprimirlo o exportarlo.

## Cómo acota

| Campo | Detalle |
| --- | --- |
| **F.Ord.Desde / Hasta** | **obligatorias las dos**. Arrancan las dos en el **día operativo**, o sea un solo día |
| **Cliente / Vehiculo** | acotan; vacío es todos |
| **Especie** | 🔴 **tiene que ser un TÍTULO**: si se carga una especie que no cuelga de `TITULO`, el diálogo la rechaza con *"Debe ingresar un Titulo"* |
| **Tipos Ordenes** | multiselect, pero **la lista está recortada en el script** a ocho tipos (`OEQC`, `OEQV`, `OTIC`, `OTIV`, `OCSEC`, `OVSEC`, `CSEC`, `VSEC`) |

⚠️ **El rango arranca en un solo día.** Una orden de ayer no aparece hasta correr el "desde".

⚠️ **La lista de tipos no muestra todos los que existen.** Está fija en el código, así que un tipo
de orden que no esté entre esos ocho **no se puede pedir desde acá**, y las órdenes de ese tipo no
salen en el informe. No es un problema de permisos ni de datos.

## De dónde sale

De `ORDENES`, cruzada con `TIPOSORDEN` e `INSTANCIAS` (el estado en el circuito).
