## Para qué sirve

**Liquida las operaciones de un vehículo a una fecha.** Es uno de los eventos centrales del día:
toma las operaciones que corresponden y las marca como liquidadas.

## Qué modifica

Escribe en `OPERACIONES`. **Es una escritura directa sobre el estado de las operaciones**, no una
simulación.

## Los campos

| Campo | Detalle |
| --- | --- |
| **Vehiculo** | obligatorio; arranca precargado con el vehículo por defecto del usuario |
| **Fecha Liq.** | obligatoria; arranca en el día operativo |
| **Incluye Pend** | apagado por defecto: suma las pendientes |
| **Mercado / Cliente / Especie** | acotan. 🔴 **Se vuelven obligatorios** cuando se pide selección manual |

## 🔴 Los grupos de operación: hay que elegir al menos uno

Las tildes `Titulos`, `F.Exchange`, `M.Market`, `Prestamos` y `Futuros` eligen **qué grupo de
operaciones se liquida**. Arrancan con Títulos, F.Exchange y M.Market prendidos.

**Si se apagan todos, el evento no deja seguir**: pide *"Debe seleccionar un grupo de
operaciones"*.

⚠️ **Las tildes se apagan entre sí.** Prendiendo Futuros, el script apaga solo Títulos y M.Market —
no es un error de la pantalla, es la regla: esos grupos no se liquidan en la misma corrida.

⚠️ **El mercado tiene un filtro propio que no se ve**: el buscador sólo ofrece mercados que no
netean y que están marcados como de títulos. Un mercado que no aparece en la lista no es un error de
permisos.
