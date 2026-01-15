# Assets para etiquetas (Print Labels)

Este módulo permite mostrar un **logo estándar** en el preview y también incrustarlo en el ZPL.

## Preview (web)
Coloca un logo en cualquiera de estas rutas:
- `public/labels/logo.svg` (recomendado)
- `public/labels/logo.png`

La UI intentará cargar primero `logo.svg` y si falla probará `logo.png`.

## Impresión (ZPL)
Coloca el snippet ZPL del logo (por ejemplo un bloque `^FO...^GFA,...^FS`) en:
- `public/labels/logo.zpl`

Para impresoras con compatibilidad limitada (por ejemplo **Zebra GC420t por USB**), usa:
- `public/labels/logo-compat.zpl`

En esos modelos, la compresión `:Z64:` dentro de `^GFA` es una causa común de que la impresora imprima errores (p.ej. “error01”).
El archivo `logo-compat.zpl` debe evitar `:Z64:`.

Ese contenido se concatena al ZPL de cada etiqueta.

Nota: por licenciamiento/propiedad, el repo no trae el logo ZPL real.
