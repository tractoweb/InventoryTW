export type StickerLayout = {
  nameLinesMax: number;
  nameFont: number;
  posFont: number;
  dateFont: number;
  lineGap: number;

  // Y positions (dots)
  nameY: number;
  posY: number;
  dateY: number;
  barcodeY: number;
  barcodeTextY: number;

  // Barcode geometry (dots)
  barcodeH: number;
  barcodeTextH: number;
  barcodeGap: number;

  bottomPad: number;
  minGap: number;
};

function cmToDots(cm: number, dpi: number): number {
  return Math.round((cm * dpi) / 2.54);
}

/**
 * Computes a safe 3-up sticker layout that prevents overlaps between text and barcode.
 * It adaptively reduces fonts/lines when needed.
 */
export function compute3UpStickerLayout(dpi: number, rawName: string): StickerLayout {
  const safeDpi = Number.isFinite(dpi) ? Math.max(100, Math.trunc(dpi)) : 203;

  // Geometry (must match ZPL generator assumptions)
  const labelH = cmToDots(2.5, safeDpi);
  const marginTop = cmToDots(0.1, safeDpi);
  const marginBottomBase = cmToDots(0.1, safeDpi);

  // Vertical placement
  const nameYOffset = cmToDots(0.23, safeDpi);
  const nameY = marginTop + nameYOffset;

  // Barcode block
  const barcodeH = 40;
  const barcodeTextH = 18;
  const barcodeGap = cmToDots(0.1, safeDpi);

  const barcodeTotalH = barcodeH + barcodeGap + barcodeTextH;

  const minGap = cmToDots(0.05, safeDpi);

  const name = String(rawName ?? "").trim();
  const nameLen = name.length;

  const desiredLines = nameLen > 30 ? 3 : 2;
  const linesCandidates = Array.from(new Set([desiredLines, 2, 1]));

  // Candidate fonts (dots). The algorithm will pick the first combination that fits.
  const nameFontCandidates = nameLen > 60 ? [18, 16] : nameLen > 45 ? [20, 18, 16] : nameLen > 20 ? [20, 18, 16] : [28, 20, 18];
  const posFontCandidates = [22, 20, 18, 16];
  const dateFontCandidates = [20, 18, 16, 14];
  const lineGapCandidates = [2, 0];

  // We can slightly reduce bottom padding if needed to create more vertical room.
  const bottomPadCandidates = [
    marginBottomBase + cmToDots(0.0, safeDpi),
    Math.max(0, marginBottomBase - cmToDots(0.05, safeDpi)),
    Math.max(0, marginBottomBase - cmToDots(0.1, safeDpi)),
  ];

  for (const bottomPad of bottomPadCandidates) {
    const barcodeY = labelH - bottomPad - barcodeTotalH;

    for (const nameLinesMax of linesCandidates) {
      for (const nameFont of nameFontCandidates) {
        const nameBlockH = nameFont * nameLinesMax + 2;
        const posY = nameY + nameBlockH;

        for (const posFont of posFontCandidates) {
          for (const dateFont of dateFontCandidates) {
            for (const lineGap of lineGapCandidates) {
              const dateY = posY + posFont + lineGap;
              const textBottom = dateY + dateFont;

              if (textBottom <= barcodeY - minGap) {
                const barcodeTextY = barcodeY + barcodeH + barcodeGap;

                return {
                  nameLinesMax,
                  nameFont,
                  posFont,
                  dateFont,
                  lineGap,
                  nameY,
                  posY,
                  dateY,
                  barcodeY,
                  barcodeTextY,
                  barcodeH,
                  barcodeTextH,
                  barcodeGap,
                  bottomPad,
                  minGap,
                };
              }
            }
          }
        }
      }
    }
  }

  // Absolute fallback: smallest fonts/1 line, minimum gap, minimum bottom pad.
  const bottomPad = Math.max(0, marginBottomBase - cmToDots(0.1, safeDpi));
  const barcodeY = labelH - bottomPad - barcodeTotalH;
  const nameLinesMax = 1;
  const nameFont = 16;
  const posFont = 16;
  const dateFont = 14;
  const lineGap = 0;
  const nameBlockH = nameFont * nameLinesMax + 2;
  const posY = nameY + nameBlockH;
  const dateY = posY + posFont + lineGap;
  const barcodeTextY = barcodeY + barcodeH + barcodeGap;

  return {
    nameLinesMax,
    nameFont,
    posFont,
    dateFont,
    lineGap,
    nameY,
    posY,
    dateY,
    barcodeY,
    barcodeTextY,
    barcodeH,
    barcodeTextH,
    barcodeGap,
    bottomPad,
    minGap,
  };
}
