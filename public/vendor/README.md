# Zebra BrowserPrint SDK

Este proyecto integra Zebra Browser Print para impresión USB desde el navegador.

Por licenciamiento, el archivo del SDK **no se incluye** en el repositorio.

## Qué archivo colocar
- Descarga/ubica el archivo (cualquiera de estos nombres funciona):
  - `BrowserPrint-3.1.250.min.js`
  - `BrowserPrint-3.0.216.min.js`
- Colócalo en esta ruta:
  - `public/vendor/BrowserPrint-3.1.250.min.js` (recomendado)
  - o `public/vendor/BrowserPrint-3.0.216.min.js`

Tip: al terminar, reinicia `pnpm run dev` para que Next sirva el archivo.

## Por qué
- En producción (HTTPS), cargar el SDK desde `http://localhost:9101/...` puede ser bloqueado por el navegador (Mixed Content).
- Sirviéndolo desde el propio sitio (`/vendor/...`) mejora la estabilidad.

## Requisito adicional
Aun con el SDK servido desde el sitio, el servicio **Zebra Browser Print** debe estar instalado y corriendo en el PC que imprime.

## Troubleshooting rápido
- Si ves "No se pudo cargar el SDK de BrowserPrint desde /vendor/...": el archivo no está en `public/vendor/` (o el servidor no se reinició).
- Si estás en HTTPS y no lista impresoras: habilita "Insecure content" para el sitio o usa HTTP en el PC de impresión.

