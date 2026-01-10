import { LabelData } from '../types/label.types';

// Template ZPL para etiqueta 3.2cm x 2.5cm, con logo (debe insertarse el bloque ^GF generado)
export const generateProductLabel = (data: LabelData): string => {
  return `
^XA
^CI28
^FO20,20^GFA,{{LOGO_HEX}}^FS
^FO20,100^A0N,30,30^FD${data.nombreProducto.substring(0, 20)}^FS
^FO20,140^BY2
^BCN,60,Y,N,N
^FD${data.codigoBarras}^FS
^FO20,230^A0N,20,20^FD${data.lote || ''}^FS
^FO180,230^A0N,20,20^FD${data.fecha || ''}^FS
^XZ
  `.trim();
};
