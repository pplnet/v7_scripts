## Para qué sirve

**Genera las compraventas que corresponden a los pases de títulos.** Crea las operaciones de compra
y venta a partir de los pases pendientes.

## 🔴 No pide nada y además ejecuta GENPAT

Este evento **no tiene diálogo**: arranca apenas se lo elige. Y por dentro **dispara GENPAT** (la
generación de patas del pase), así que una sola ejecución encadena las dos cosas.

Al elegirlo desde el menú aparece el cartel *"El evento que seleccionó no posee diálogo, ¿Desea
ejecutarlo?"*. Es la única chance de frenarlo.

## Qué modifica

Escribe directo en la base:

- **crea operaciones** en `OPERACIONES`,
- actualiza `MOVLIMITES` y las instancias en `OPERACIONESBITS`,
- registra excepciones en `EXCEPCIONES`.

**No hay deshacer.** Si la generación falla a mitad de camino, la reversa la hace GENPAT sobre las
patas que alcanzó a crear.

⚠️ Corre sobre todo lo que encuentre pendiente, así que **dos corridas seguidas no hacen lo mismo**:
la segunda ya no encuentra lo que procesó la primera.
