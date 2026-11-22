export const PRINT_PAPERS = ["58mm", "80mm", "a4"] as const;
export type PrintPaper = (typeof PRINT_PAPERS)[number];
export type PrintLayout = "brand" | "classic" | "compact";
export type PrintLogoPosition = "left" | "center" | "right";

export type PrintTemplate = {
  id: number | null;
  name: string;
  paper: PrintPaper;
  layout: PrintLayout;
  logo_position: PrintLogoPosition;
  accent_color: string;
  logo_size: number;
  name_size: number;
  show_logo: boolean;
  show_name: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_separator: boolean;
  show_qr: boolean;
  show_footer: boolean;
  footer_text: string | null;
  is_default: boolean;
};

export function defaultPrintTemplate(paper: PrintPaper): PrintTemplate {
  return {
    id: null, name: "Standard", paper, layout: "brand",
    logo_position: "left", accent_color: "#172554",
    logo_size: paper === "a4" ? 100 : paper === "58mm" ? 43 : 60,
    name_size: paper === "a4" ? 30 : paper === "58mm" ? 15 : 18,
    show_logo: true, show_name: true, show_address: true,
    show_phone: true, show_email: true, show_separator: true,
    show_qr: true, show_footer: true, footer_text: null, is_default: true,
  };
}

// Revalidate values before interpolating into CSS. The server validates on
// write too, but cached/local data should never inject arbitrary CSS or HTML.
export function safePrintTemplate(raw: Partial<PrintTemplate> | null | undefined, paper: PrintPaper): PrintTemplate {
  const base = defaultPrintTemplate(paper);
  if (!raw) return base;
  const n = (value: number | undefined, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(Math.max(min, Math.min(max, value))) : fallback;
  const bool = (key: keyof PrintTemplate) =>
    typeof raw[key] === "boolean" ? raw[key] as boolean : base[key] as boolean;
  return {
    ...base,
    id: typeof raw.id === "number" && Number.isSafeInteger(raw.id) && raw.id > 0 ? raw.id : null,
    name: typeof raw.name === "string" ? raw.name.slice(0, 100) : base.name,
    layout: raw.layout === "classic" || raw.layout === "compact" ? raw.layout : "brand",
    logo_position: raw.logo_position === "right" || raw.logo_position === "center" ? raw.logo_position : "left",
    accent_color: typeof raw.accent_color === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.accent_color)
      ? raw.accent_color : base.accent_color,
    logo_size: n(raw.logo_size, base.logo_size, 28, 130),
    name_size: n(raw.name_size, base.name_size, 12, 42),
    show_logo: bool("show_logo"), show_name: bool("show_name"),
    show_address: bool("show_address"), show_phone: bool("show_phone"),
    show_email: bool("show_email"), show_separator: bool("show_separator"),
    show_qr: bool("show_qr"), show_footer: bool("show_footer"),
    footer_text: typeof raw.footer_text === "string" ? raw.footer_text.slice(0, 1000) : null,
    is_default: raw.is_default === true,
  };
}
