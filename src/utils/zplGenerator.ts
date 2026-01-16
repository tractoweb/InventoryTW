import { LabelData } from '../types/label.types';

function sanitizeZplField(value: unknown): string {
  // Remove control chars (including the stray \x10 seen sometimes when copy/pasting ZPL)
  // and escape ZPL control characters.
  const s = String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // In ZPL, ^ and ~ are control chars; to print them you double them.
  return s.replace(/\^/g, "^^").replace(/~/g, "~~");
}

export type GenerateProductLabelOptions = {
  /** Include a setup header (like the legacy example's first ^XA...^XZ). */
  includeDefaultsHeader?: boolean;
  /** If provided, appends ^PQ{copies} to let the printer duplicate labels. */
  copies?: number;
  /** Raw ZPL snippet to be inserted near the top of the label (e.g. ^FO..^GFA..^FS). */
  logoZpl?: string;
};

export type Generate3UpLabelOptions = {
  includeDefaultsHeader?: boolean;
  /** Raw ZPL snippet (logo) that uses ^FO commands; will be offset per column. */
  logoZpl?: string;
  /** Zebra DPI; defaults to 203 (8 dots/mm). */
  dpi?: number;
  /** Draw a rounded border per sticker (can be disabled for firmware compatibility). */
  includeBorder?: boolean;
};

function cmToDots(cm: number, dpi: number): number {
  const dots = (cm * dpi) / 2.54;
  return Math.round(dots);
}

function offsetZplFo(zpl: string, xOffset: number, yOffset: number): string {
  // Applies offsets to ^FOx,y occurrences.
  // Keeps everything else intact.
  return String(zpl ?? "").replace(/\^FO(\d+),(\d+)/g, (_m, x, y) => {
    const nx = Math.max(0, Number(x) + xOffset);
    const ny = Math.max(0, Number(y) + yOffset);
    return `^FO${nx},${ny}`;
  });
}

export const generate3UpLabelsRow = (labels: LabelData[], options?: Generate3UpLabelOptions): string => {
  // Media layout (cm)
  // - 3 columns
  // - label: 3.2cm x 2.5cm
  // - outer margins (web): left/right 0.2cm
  // - gaps between labels: 0.2cm (horizontal)
  // - vertical gap between rows: 0.2cm (pitch = 2.5 + 0.2)
  // - content margins: top/bottom 0.1cm (keeps printing away from edges)
  const dpi = Number.isFinite(options?.dpi) ? Math.max(100, Math.trunc(Number(options?.dpi))) : 203;

  const labelW = cmToDots(3.2, dpi);
  const labelH = cmToDots(2.5, dpi);
  const outerX = cmToDots(0.2, dpi);
  const gapX = cmToDots(0.2, dpi);
  const gapY = cmToDots(0.2, dpi);
  const marginTop = cmToDots(0.1, dpi);
  const marginBottom = cmToDots(0.1, dpi);
  const cornerR = cmToDots(0.1, dpi);
  const includeBorder = options?.includeBorder ?? false;

  const totalW = outerX + labelW + gapX + labelW + gapX + labelW + outerX;
  const pitchH = labelH + gapY;

  // IMPORTANT: Do not emit a standalone ^XA...^XZ "header label".
  // Some printers will treat it as a blank label (or error) and can print error pages.

  const slots = labels.slice(0, 3);
  const logoZplRaw = String(options?.logoZpl ?? "").trim();

  const blocks = slots
    .map((data, i) => {
      const x0 = outerX + i * (labelW + gapX);
      const y0 = 0;

      const nombreRaw = sanitizeZplField(data.nombreProducto);
      const nombre = nombreRaw.slice(0, 90);
      const barcode = sanitizeZplField(data.codigoBarras);
      const lote = sanitizeZplField(data.lote ?? "").slice(0, 30);
      const fecha = sanitizeZplField(data.fecha ?? "").slice(0, 30);

      const logoZpl = logoZplRaw ? offsetZplFo(logoZplRaw, x0, y0) : "";

      const border = includeBorder
        ? `^FO${x0},${y0}^GB${labelW},${labelH},2,B,${Math.max(0, cornerR)}^FS`
        : null;

      const textX = x0 + outerX; // reuse 0.2cm as internal padding
      const textW = Math.max(10, labelW - outerX * 2);
      const nameY = y0 + marginTop + cmToDots(0.15, dpi);

      // Keep names inside the sticker:
      // - allow wrapping to up to 3 lines
      // - shrink font when the name is long (otherwise it would overlap the next fields)
      const nameFont = nombre.length > 20 ? 20 : 28;

      // Place "posición" and "fecha" as a stacked column below the name block.
      // These Y positions are chosen to avoid colliding with the barcode block near the bottom.
      const posY = y0 + cmToDots(1.15, dpi);
      const dateY = posY + cmToDots(0.25, dpi);

      const barcodeX = textX;
      const barcodeH = 40;
      const barcodeTextH = 18;
      const barcodeGap = cmToDots(0.1, dpi);
      const bottomPad = marginBottom + cmToDots(0.1, dpi);
      const barcodeY = Math.max(
        // Keep barcode below the stacked fields (pos/date)
        dateY + cmToDots(0.1, dpi),
        // Also anchor to bottom
        y0 + labelH - bottomPad - (barcodeH + barcodeGap + barcodeTextH)
      );
      const barcodeTextY = barcodeY + barcodeH + barcodeGap;

      return [
        border,
        logoZpl ? logoZpl : null,
        `^FO${textX},${nameY}^A0N,${nameFont},${nameFont}^FB${textW},3,0,L,0^FD${nombre}^FS`,
        `^FO${textX},${posY}^A0N,22,22^FD${lote}^FS`,
        `^FO${textX},${dateY}^A0N,20,20^FD${fecha}^FS`,
        `^FO${barcodeX},${barcodeY}^BY1,3,40^BCN,${barcodeH},N,N,N^FD${barcode}^FS`,
        `^FO${x0},${barcodeTextY}^FB${labelW},1,0,C,0^A0N,${barcodeTextH},${barcodeTextH}^FD${barcode}^FS`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return (
    `^XA
^CI28
^PW${totalW}
^LL${pitchH}
^LH0,0
^LS0
${blocks}
^XZ`
  ).trim();
};

// Template ZPL basado en el ejemplo "legacy" que estabas usando (sin incrustar gráficos).
// Tamaño y comandos de barcode alineados con: ^PW831, ^LL0216, ^BY1,3,40 y ^BCN.
export const generateProductLabel = (data: LabelData, options?: GenerateProductLabelOptions): string => {
  const nombreRaw = sanitizeZplField(data.nombreProducto);
  const nombre = nombreRaw.slice(0, 120);
  const barcode = sanitizeZplField(data.codigoBarras);
  const lote = sanitizeZplField(data.lote ?? "").slice(0, 30);
  const fecha = sanitizeZplField(data.fecha ?? "").slice(0, 30);

  const nameFont = nombre.length > 24 ? 22 : 28;

  const includeDefaultsHeader = options?.includeDefaultsHeader ?? true;
  const copiesRaw = options?.copies;
  const copies = Number.isFinite(copiesRaw) ? Math.max(1, Math.trunc(Number(copiesRaw))) : null;
  const logoZpl = String(options?.logoZpl ?? "").trim();

  const header = includeDefaultsHeader
    ? "^XA~TA000~JSN^LT0^MNW^MTT^PON^PMN^LH0,0^JMA^PR2,2~SD15^JUS^LRN^CI0^XZ\n"
    : "";

  return (
    header +
    `^XA
^MMT
^PW831
^LL0216
^LS0
^CI28
${logoZpl ? `${logoZpl}\n` : ""}
^FO40,16^A0N,${nameFont},${nameFont}^FB751,3,0,L,0^FD${nombre}^FS
^FO40,92^A0N,22,22^FD${lote}^FS
^FO40,112^A0N,20,20^FD${fecha}^FS
^FO40,130^BY1,3,40^BCN,40,N,N,N^FD${barcode}^FS
^FO0,174^FB831,1,0,C,0^A0N,16,16^FD${barcode}^FS
${copies ? `^PQ${copies},0,1,Y` : ""}
^XZ`
  ).trim();
};
