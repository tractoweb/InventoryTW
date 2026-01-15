export {};

declare global {
  export type BrowserPrintDevice = {
    name: string;
    uid?: string;
    connection?: string;
    send: (
      data: string,
      success?: (response?: unknown) => void,
      error?: (err?: unknown) => void
    ) => void;
  };

  export type BrowserPrintApi = {
    getDefaultDevice: (
      type: "printer",
      success: (device: BrowserPrintDevice) => void,
      error?: (err?: unknown) => void
    ) => void;

    getLocalDevices: (
      success: (devices: BrowserPrintDevice[]) => void,
      error?: (err?: unknown) => void,
      type?: "printer"
    ) => void;
  };

  interface Window {
    BrowserPrint?: BrowserPrintApi;
  }
}
