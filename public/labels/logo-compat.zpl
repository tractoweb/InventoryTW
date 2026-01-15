^FX Logo COMPATIBLE (GC420t / firmwares que NO soportan :Z64:)
^FX
^FX Este archivo se inserta dentro del ZPL de cada etiqueta.
^FX Requisitos:
^FX - NO debe incluir ^XA/^XZ
^FX - Debe ser un snippet listo para pegar (por ejemplo: ^FO..^GFA,..^FS)
^FX - EVITA compresión :Z64: (causa frecuente de “error01” en GC420t por USB)
^FX
^FX Cómo generarlo (recomendado):
^FX 1) Exporta tu logo como MONOCHROME (1-bit) a 203dpi.
^FX 2) Genera un ^GFA en ASCII HEX sin :Z64: (o usa ZebraDesigner para convertir).
^FX 3) Pega aquí SOLO el/los campos del gráfico y cierra cada uno con ^FS.
^FX
^FX Ejemplo de estructura (rellenar con tu HEX real):
^FX ^FO32,0^GFA,totalBytes,totalBytes,bytesPerRow,<HEX...>^FS

^FX TODO: pega aquí el logo compatible (sin :Z64:)
