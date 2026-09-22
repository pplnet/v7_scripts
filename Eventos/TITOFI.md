## Para qué sirve

**Genera el archivo del Comunicado "A" 6584 del BCRA** (TITOFIN): la información de títulos que hay
que presentar, en un TXT con el formato que pide el regulador.

## 🔴 Volver a generar el MISMO mes DUPLICA las líneas del archivo

Es el problema más importante de este evento y no da ningún error.

El script intenta borrar el TXT anterior antes de escribir, pero **ese borrado hoy no funciona**, y
como el archivo se abre en modo "agregar", la segunda corrida del mismo mes **suma las líneas a las
que ya estaban**. El archivo queda con todo duplicado y aparenta estar bien.

**Antes de regenerar un mes ya generado, hay que borrar el TXT a mano desde el explorador de
archivos.**

## ⚠️ La ruta se guarda en MAYÚSCULAS

El campo del archivo de salida tiene máscara de mayúsculas: lo que se tipee se convierte. Como el
almacenamiento distingue mayúsculas de minúsculas, el archivo puede terminar en una carpeta
**distinta** de la que se ve en el explorador —creada al vuelo, sin ningún error— y después "no
aparece". Si un archivo generado no se encuentra, buscarlo también en la ruta en mayúsculas.

## Los campos

| Campo | Detalle |
| --- | --- |
| **Fecha** | el mes a informar. Arranca en el **primer día del mes en curso** y no puede ser posterior al día operativo |
| **UltHabil** | se calcula solo: último hábil del mes de la fecha |
| **FechaAccion** | se calcula solo, a partir del anterior |
| **Rectifica?** | arranca en **NO**. En SÍ, es una presentación rectificativa |
| **Genera_txt?** | arranca en **SÍ**. En NO, sólo muestra el informe en pantalla y **no escribe el archivo** |
| **Arch.Output** | la ruta del TXT. Se propone sola con el mes en el nombre (`TITOFIN-aaaamm.TXT`). Obligatoria si se genera el archivo |

⚠️ **`Genera_txt?` es la tilde que decide si se escribe el archivo.** Para sólo mirar el contenido
sin tocar nada, ponerlo en NO — y así también se evita el problema de la duplicación.
