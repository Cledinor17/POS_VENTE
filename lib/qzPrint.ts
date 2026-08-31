type QzModule = import("qz-tray").Qz;

let qzPromise: Promise<QzModule> | null = null;
let unsignedModeConfigured = false;

function loadQz(): Promise<QzModule> {
  if (!qzPromise) {
    // Dynamic import: qz-tray touches browser-only globals, so it must never
    // be evaluated during server-side rendering.
    qzPromise = import("qz-tray").then((mod) => mod.default ?? (mod as unknown as QzModule));
  }
  return qzPromise;
}

function configureUnsignedMode(qz: QzModule) {
  if (unsignedModeConfigured) return;

  // Pas de certificat pour le moment : QZ Tray affichera une confirmation
  // manuelle a l'utilisateur une fois par session sur ce poste.
  qz.security.setCertificatePromise((resolve) => resolve(""));
  qz.security.setSignaturePromise(() => (resolve) => resolve(""));

  unsignedModeConfigured = true;
}

async function ensureConnected(): Promise<QzModule> {
  const qz = await loadQz();
  configureUnsignedMode(qz);

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }
  return qz;
}

export async function printRawEscposViaQz(printerName: string, base64Data: string): Promise<void> {
  const qz = await ensureConnected();
  const config = qz.configs.create(printerName);
  await qz.print(config, [{ type: "raw", format: "base64", data: base64Data }]);
}

export async function isQzAvailable(): Promise<boolean> {
  try {
    await ensureConnected();
    return true;
  } catch {
    return false;
  }
}
