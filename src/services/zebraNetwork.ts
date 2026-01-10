// Envío de ZPL a impresora Zebra por red (puerto 9100)
// Requiere que la impresora esté en la red y accesible por IP
import net from 'net';

export const sendToPrinter = (zpl: string, printerIp: string = '192.168.1.100', port: number = 9100): Promise<void> => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(port, printerIp, () => {
      client.write(zpl, () => {
        client.end();
        resolve();
      });
    });
    client.on('error', (err) => {
      reject(err);
    });
  });
};
