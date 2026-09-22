## Para qué sirve

**Genera la agenda de cupones de una especie**: las fechas y los importes de renta, amortización y
capitalización que la especie va a pagar a lo largo de su vida.

## Qué modifica

Escribe la agenda en `AGENDACUPONES`. **Reemplaza lo que hubiera**, así que volver a generarla
sobre una especie que ya la tiene la regenera.

## 🔴 El diálogo tiene SOLAPAS, y eso cambia cómo se usa

No es una pantalla: son **siete**, y hay que ir completando la que corresponda al tipo de cupón.

| Solapa | Para qué |
| --- | --- |
| **General** | la especie, el criterio de feriados y el número de cupón. **Siempre hay que completarla** |
| **Renta** | el rango de fechas y la frecuencia de pago |
| **Amortizacion** | las amortizaciones |
| **Capitalizacion** | las capitalizaciones |
| **Amortizacion Int.Capitalizados** | amortización de intereses capitalizados |
| **Zero Coupon** y **Zero Coupon Capitalizacion** | especies sin cupón corriente |

⚠️ **Quien mira sólo la primera solapa cree que el diálogo pide cuatro datos.** Los que definen la
agenda están en las otras.

## Los campos de la solapa General

| Campo | Detalle |
| --- | --- |
| **Especie** | obligatoria |
| **Feriados** | `Fijo`, `Hábil Anterior` o `Hábil Siguiente`. Arranca en **Fijo** |
| **Tabla Feriados** | 🔴 **aparece sólo si Feriados no es `Fijo`**, y ahí se vuelve obligatoria |
| **Nro. Cupon** | desde qué cupón genera. Arranca en **1**, y tiene que ser mayor que 0 |

## En la solapa Renta

Las fechas **desde** y **hasta** arrancan tomadas de la especie (su fecha de emisión y su fecha de
vencimiento), así que ya vienen cargadas al elegirla.

⚠️ **Las dos van juntas**: cargando una sola, el evento pide la otra.
