## Para qué sirve

**Arma los datos del Comunicado "A" 6584 del BCRA** para una fecha y un vehículo: recorre las
posiciones y los asientos configurados y deja el resultado en la tabla **`DETITOFIN`**.

Es el paso de **cálculo**. El que después toma esa tabla y escribe el TXT que se le presenta al
regulador es **`TITOFI`**.

## Qué modifica

| Tabla | Qué hace |
| --- | --- |
| **`DETITOFIN`** | **borra lo de esa fecha y lo vuelve a escribir** |

## 🔴 Es idempotente por FECHA, y por eso se puede repetir

Lo primero que hace es borrar de `DETITOFIN` todo lo que tenga la fecha de proceso, y recién después
inserta. Correrlo dos veces sobre la misma fecha **no duplica nada**.

⚠️ **Es lo contrario de `TITOFI`**, que sí duplica al regenerar el mismo mes. Son dos scripts del
mismo circuito con comportamientos opuestos al repetirlos: conviene no asumir el de uno mirando el
otro.

## Los campos

| Campo | Detalle |
| --- | --- |
| **Fecha** | la fecha a procesar. Arranca en el **día operativo** |
| **Vehiculo** | arranca precargado con el valor de la variable `VEHICON`, no en blanco |

⚠️ **El vehículo viene cargado**, así que quien no lo mire está generando el de la configuración por
defecto. No es un filtro opcional: lo que no sea ese vehículo no entra.

## Qué mira para armar la tabla

1. **Posiciones** del vehículo a esa fecha, tomando el saldo contable de libre disponibilidad
   (`SALDOPOCON`) y **la última fecha con posición** de cada especie, que puede ser anterior a la
   pedida.
2. **Asientos** de los tipos de cuenta marcados para informar (`InformaTitofin`) y sus modelos.
3. **Lo informado el día hábil anterior** que hoy no volvió a salir: si la operación **todavía no
   venció**, se arrastra con la fecha de hoy.

## 🔴 El arrastre del día anterior es lo que menos se espera

Ese tercer paso hace que aparezcan filas que **no salen de las posiciones de hoy**: vienen de lo
informado ayer. Es deliberado —una operación vigente no puede desaparecer del informe porque ese día
no tuvo movimiento— pero explica por qué el total no cierra contra un corte de posiciones del día.

⚠️ Sólo arrastra los registros de **tipo `A`** y sólo mientras la operación no haya vencido.

## Relacionado

- **`TITOFI`** — escribe el TXT que se presenta, a partir de esta tabla.
- Los includes `ELREGINFOR`, `POSREINFOR`, `ASIREINFOR` y `TITOFIAYER` son las cuatro etapas de
  arriba, en ese orden.
