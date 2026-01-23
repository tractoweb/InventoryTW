import { LabelData } from '../types/label.types';
import { compute3UpStickerLayout } from './labelLayout';

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
  /** Print darkness (0-30). If omitted, uses env NEXT_PUBLIC_ZEBRA_DARKNESS/ZEBRA_DARKNESS or defaults. */
  darkness?: number;
};

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function getZebraDarkness(explicit?: number) {
  // Zebra: typical supported range is 0-30 for ~SD.
  if (Number.isFinite(explicit)) return clampInt(Number(explicit), 0, 30);
  const raw = Number(process.env.NEXT_PUBLIC_ZEBRA_DARKNESS ?? process.env.ZEBRA_DARKNESS ?? 25);
  return clampInt(raw, 0, 30);
}

function getBarcodeByParams(barcode: string) {
  // Keep within narrow labels: long barcodes get thinner modules.
  const len = String(barcode ?? "").trim().length;
  if (len >= 14) return { moduleW: 1, ratio: 2 };
  if (len >= 10) return { moduleW: 2, ratio: 2 };
  return { moduleW: 2, ratio: 3 };
}

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

export const generate3UpLabelsRow = (
  labels: Array<LabelData | null | undefined>,
  options?: Generate3UpLabelOptions
): string => {
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

  // Printer drift compensation: move all content slightly to the RIGHT.
  // 3mm = 0.3cm.
  const xShift = cmToDots(0.3, dpi);

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

      const border = includeBorder
        ? `^FO${x0},${y0}^GB${labelW},${labelH},2,B,${Math.max(0, cornerR)}^FS`
        : null;

      if (!data) {
        return [border].filter(Boolean).join("\n");
      }

      const nombreRaw = sanitizeZplField(data.nombreProducto);
      const nombre = nombreRaw.slice(0, 90);
      const barcode = sanitizeZplField(data.codigoBarras);
      const lote = sanitizeZplField(data.lote ?? "").slice(0, 30);
      const fecha = sanitizeZplField(data.fecha ?? "").slice(0, 30);

      const logoZpl = logoZplRaw ? offsetZplFo(logoZplRaw, x0 + xShift, y0) : "";

      const textX = x0 + xShift + outerX; // reuse 0.2cm as internal padding
      const textW = Math.max(10, labelW - outerX * 2 - xShift);
      const barcodeX = textX;
      const layout = compute3UpStickerLayout(dpi, nombre);
      const nameY = y0 + layout.nameY;
      const nameFont = layout.nameFont;
      const nameLinesMax = layout.nameLinesMax;
      const posFont = layout.posFont;
      const dateFont = layout.dateFont;
      const posY = y0 + layout.posY;
      const dateY = y0 + layout.dateY;
      const barcodeH = layout.barcodeH;
      const barcodeTextH = layout.barcodeTextH;
      const barcodeGap = layout.barcodeGap;
      const barcodeY = y0 + layout.barcodeY;
      const barcodeTextY = y0 + layout.barcodeTextY;
      const { moduleW, ratio } = getBarcodeByParams(barcode);

      return [
        border,
        logoZpl ? logoZpl : null,
        `^FO${textX},${nameY}^A0N,${nameFont},${nameFont}^FB${textW},${nameLinesMax},0,L,0^FD${nombre}^FS`,
        `^FO${textX},${posY}^A0N,${posFont},${posFont}^FD${lote}^FS`,
        `^FO${textX},${dateY}^A0N,${dateFont},${dateFont}^FD${fecha}^FS`,
        `^FO${barcodeX},${barcodeY}^BY${moduleW},${ratio},${barcodeH}^BCN,${barcodeH},N,N,N^FD${barcode}^FS`,
        `^FO${x0 + xShift},${barcodeTextY}^FB${Math.max(10, labelW - xShift)},1,0,C,0^A0N,${barcodeTextH},${barcodeTextH}^FD${barcode}^FS`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const darkness = getZebraDarkness(options?.darkness);

  return (
    `^XA
^CI28
^PR2,2
~SD${darkness}
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
    ? `^XA~TA000~JSN^LT0^MNW^MTT^PON^PMN^LH0,0^JMA^PR2,2~SD${getZebraDarkness()}^JUS^LRN^CI0^XZ\n`
    : "";

  const { moduleW, ratio } = getBarcodeByParams(barcode);

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
^FO40,130^BY${moduleW},${ratio},40^BCN,40,N,N,N^FD${barcode}^FS
^FO0,174^FB831,1,0,C,0^A0N,16,16^FD${barcode}^FS
${copies ? `^PQ${copies},0,1,Y` : ""}
^XZ`
  ).trim();
};
