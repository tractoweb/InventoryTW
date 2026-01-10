import { generateProductLabel } from '../utils/zplGenerator';
import { LabelData } from '../types/label.types';
import { sendToPrinter } from './zebraNetwork';

// Imprime una etiqueta de producto usando la red
export const printProductLabel = async (product: LabelData, printerIp: string = '192.168.1.100') => {
  try {
    const zpl = generateProductLabel(product);
    await sendToPrinter(zpl, printerIp);
  } catch (error) {
    console.error('Error en el módulo de impresión:', error);
    throw error;
  }
};
