declare module "qz-tray" {
  type PromiseCallback = (resolve: (value: string) => void, reject: (reason?: unknown) => void) => void;

  interface QzPrintData {
    type: "raw" | "pixel";
    format: "base64" | "plain" | "hex" | "file" | "image";
    data: string;
  }

  interface QzPrinterConfig {
    // Opaque handle returned by qz.configs.create(); shape is internal to qz-tray.
    [key: string]: unknown;
  }

  export type Qz = {
    websocket: {
      connect: (options?: Record<string, unknown>) => Promise<void>;
      disconnect: () => Promise<void>;
      isActive: () => boolean;
    };
    security: {
      setCertificatePromise: (fn: PromiseCallback) => void;
      setSignaturePromise: (fn: (toSign: string) => PromiseCallback) => void;
    };
    configs: {
      create: (printerName: string, options?: Record<string, unknown>) => QzPrinterConfig;
    };
    printers: {
      find: (query?: string) => Promise<string | string[]>;
    };
    print: (config: QzPrinterConfig, data: QzPrintData[]) => Promise<void>;
  };

  const qz: Qz;
  export default qz;
}
