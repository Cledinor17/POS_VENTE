import type { CatalogProduct } from "./catalogApi";

/**
 * Code 128 (jeu B) : les 106 motifs + le motif d'arret.
 * Chaque motif est une suite de largeurs, barre puis espace en alternance.
 */
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

export type BarcodeOptions = {
  /** Largeur d'un module en px (1 = code le plus compact). */
  barWidth?: number;
  /** Hauteur des barres en px. */
  height?: number;
  /** Afficher la valeur lisible sous les barres. */
  showText?: boolean;
};

function isEncodable(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

/** Valeurs Code 128B (start + donnees + cle + stop) pour une chaine ASCII. */
function encodeCode128B(value: string): number[] | null {
  if (!value || !isEncodable(value)) return null;

  const codes: number[] = [START_B];
  for (const char of value) {
    codes.push(char.charCodeAt(0) - 32);
  }

  let checksum = START_B;
  for (let i = 1; i < codes.length; i += 1) {
    checksum += codes[i] * i;
  }

  codes.push(checksum % 103);
  codes.push(STOP);
  return codes;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rend un code-barres Code 128B en SVG (chaine). Le meme SVG sert a l'apercu
 * ecran et a l'impression des etiquettes. Renvoie null si la valeur ne peut
 * pas etre encodee (caracteres non ASCII imprimables).
 */
export function buildBarcodeSvg(value: string, options: BarcodeOptions = {}): string | null {
  const codes = encodeCode128B(value);
  if (!codes) return null;

  const barWidth = options.barWidth ?? 2;
  const height = options.height ?? 70;
  const showText = options.showText ?? true;
  const quietZone = 10; // modules, marge obligatoire de chaque cote
  const textHeight = showText ? 18 : 0;

  const rects: string[] = [];
  let cursor = quietZone;
  let isBar = true;

  for (const code of codes) {
    for (const widthChar of CODE128_PATTERNS[code]) {
      const moduleWidth = Number(widthChar);
      if (isBar) {
        rects.push(
          `<rect x="${cursor * barWidth}" y="0" width="${moduleWidth * barWidth}" height="${height}" fill="#000" />`,
        );
      }
      cursor += moduleWidth;
      isBar = !isBar;
    }
    isBar = true; // chaque motif redemarre par une barre
  }

  const totalModules = cursor + quietZone;
  const totalWidth = totalModules * barWidth;
  const totalHeight = height + textHeight;
  const text = showText
    ? `<text x="${totalWidth / 2}" y="${totalHeight - 4}" text-anchor="middle" font-family="monospace" font-size="14" letter-spacing="1" fill="#000">${escapeXml(value)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-label="Code-barres ${escapeXml(value)}"><rect width="${totalWidth}" height="${totalHeight}" fill="#fff" />${rects.join("")}${text}</svg>`;
}

/**
 * Valeur imprimee sur l'etiquette : le code-barres du produit s'il existe,
 * sinon son SKU (les deux sont reconnus par la caisse au scan).
 */
export function productBarcodeValue(product: CatalogProduct): string {
  const barcode = product.barcode.trim();
  if (barcode) return barcode;

  const sku = product.sku.trim();
  return sku && sku.toLowerCase() !== "n/a" ? sku : "";
}

export type ProductScanIndex = {
  byBarcode: Map<string, CatalogProduct>;
  bySku: Map<string, CatalogProduct>;
};

export function buildProductScanIndex(products: CatalogProduct[]): ProductScanIndex {
  const byBarcode = new Map<string, CatalogProduct>();
  const bySku = new Map<string, CatalogProduct>();

  for (const product of products) {
    const barcode = product.barcode.trim().toLowerCase();
    if (barcode) byBarcode.set(barcode, product);

    const sku = product.sku.trim().toLowerCase();
    if (sku && sku !== "n/a") bySku.set(sku, product);
  }

  return { byBarcode, bySku };
}

/**
 * Resout le produit vise par un scan. Le code-barres prime, puis le SKU
 * (etiquettes internes imprimees a partir du SKU).
 */
export function resolveScannedProduct(
  index: ProductScanIndex,
  rawCode: string,
): CatalogProduct | null {
  const normalized = rawCode.trim().toLowerCase();
  if (!normalized) return null;

  return index.byBarcode.get(normalized) ?? index.bySku.get(normalized) ?? null;
}
