## Para qué sirve

**Da de alta o modifica una especie con los datos de mercado de BYMA.** Cruza el código que informa
el mercado con la especie del sistema y actualiza su ficha.

## Qué modifica

Escribe en `ESPECIES`, leyendo de `ESPECIESMERCADOS`. **Es una escritura directa sobre el maestro
de especies**, no una propuesta a confirmar.

## Los campos

| Campo | Qué hace |
| --- | --- |
| **Especie** | la especie del sistema |
| **Codigo ingresado** | el código con el que viene del mercado |
| **Tipo Alta O Mod** | si es un alta nueva o una modificación de una existente |
| **Mercado Default** | el mercado que queda como principal |
| **BYMA / A3** | de cuál de los dos mercados se toman los datos |

⚠️ **Los rótulos son crípticos y el diálogo no valida casi nada**: ningún campo es obligatorio, así
que el evento deja seguir con la pantalla a medio llenar. Conviene tener claro el código del mercado
antes de abrirlo.
