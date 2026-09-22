## Para qué sirve

**El copiativo de boletos del día**: el listado de todos los boletos de una fecha, para archivo y
control. No es el boleto del cliente (ése es BOLEXT o BOLCPC) — es el resumen de todos.

## Los campos

| Campo | Qué hace |
| --- | --- |
| **Fecha** | el día a listar. 🔴 **No arranca en hoy**: arranca en el **día hábil siguiente al último cierre de operaciones** registrado en `FLAGSMERCADO` |
| **Provisorio / Definitivo** | arranca en **Provisorio** |
| **Vehiculo** | arranca precargado con el vehículo por defecto del usuario |
| **Mercados** (`MAE/BYMA`, `ROFEX/NDF`, `MAV`) | cada uno arranca prendido o apagado según una variable del sistema (`COPIATMB`, `COPIATROF`, `COPIATMAV`) — **no según lo que eligió la persona la vez anterior** |
| **Manual / Evento** | arranca en **Manual** |
| **Moneda Totales** | la moneda en que se totaliza. Por defecto `ARP` |

⚠️ **La fecha por defecto no es el día operativo**, y ésa es la diferencia con casi todos los demás
informes: se calcula desde el último `NCOP` de `FLAGSMERCADO`. Si el cierre no se corrió, la fecha
que propone no es la que la persona espera.

⚠️ **Los mercados tildados salen de variables del sistema.** Si alguien pregunta por qué le aparece
un mercado que no quería —o por qué le falta uno—, la respuesta está en esas variables, no en la
pantalla.

## ⚠️ El diálogo cambia según el cliente

Este script tiene **dos versiones de su diálogo** según la sigla del deploy: la de `MLASA` tiene
campos que las demás no (`Hasta Fecha`, los tres mercados, la moneda de totales). En otro cliente la
pantalla es más corta. Si una descripción de campos no coincide con lo que alguien ve, puede ser
esto.
