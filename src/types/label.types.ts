export type LabelLayoutOverride = {
  contentScalePercent?: number;
  nameFontPercent?: number;
  barcodeHeightPercent?: number;
  barcodeTextPercent?: number;
  barcodeType?: "code128" | "qrcode";
  qrScale?: number;
};

export interface LabelData {
  nombreProducto: string;
  codigoBarras: string;
  codigoVisible?: string;
  precio?: number;
  fecha?: string;
  lote?: string;
  layoutOverride?: LabelLayoutOverride;
}
