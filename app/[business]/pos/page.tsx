"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Banknote,
  Camera,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  Search,
  Smartphone,
  Star,
  Tag,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import SensitiveActionApprovalModal, {
  type SensitiveActionApproval,
} from "@/components/SensitiveActionApprovalModal";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { getBusinessSettings, type BusinessSettings } from "@/lib/businessApi";
import { hasPermission } from "@/lib/businessAccess";
import { listCustomers, type CustomerItem } from "@/lib/customersApi";
import { validateCoupon } from "@/lib/couponsApi";
import {
  listBusinessApprovers,
  type BusinessApproverAbility,
  type BusinessApproverItem,
} from "@/lib/businessUsersApi";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import { convertAmount, formatMoney } from "@/lib/currency";
import {
  DEFAULT_PRODUCT_AVATAR_PATH,
  resolveProductImageUrl,
} from "@/lib/productImage";
import {
  checkoutPosSale,
  createPosParkedCart,
  deletePosParkedCart,
  getPosPaymentMethods,
  listPosParkedCarts,
  type PosApprovalPayload,
  type PosCheckoutInput,
  type PosCheckoutResult,
  type PosParkedCart as PosParkedCartApi,
  type PosPaymentMethodConfig,
} from "@/lib/posApi";
import {
  listPrinters,
  openCashDrawer,
  printReceiptOnPrinter,
  type PrinterItem,
} from "@/lib/printersApi";
import { printRawEscposViaQz } from "@/lib/qzPrint";
import { safeGetItem, safeSetItem } from "@/lib/safeStorage";
import { enqueuePendingSale, getCachedProducts, listPendingSales, setCachedProducts } from "@/lib/offlineDb";
import { syncPendingSales } from "@/lib/offlineSync";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { getCurrentCashSession, openCashSession, type CashSession } from "@/lib/cashSessionApi";

type CartItem = {
  productId: string;
  name: string;
  sku: string;
  price: number;
  currency?: string;
  qty: number;
  type: "product" | "service";
  stock: number;
  taxRate: number;
  imagePath: string | null;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number;
};

function computeItemDiscount(
  lineGross: number,
  discountType: "percent" | "fixed" | null | undefined,
  discountValue: number | undefined,
): number {
  const value = discountValue ?? 0;
  if (!discountType || value <= 0 || lineGross <= 0) return 0;
  const amount = discountType === "percent" ? (lineGross * value) / 100 : value;
  return Math.min(lineGross, Math.max(0, amount));
}
type ParkedCart = {
  id: string;
  note: string;
  createdAt: string;
  items: CartItem[];
};
type PaymentMethodId =
  | "cash"
  | "card"
  | "mobile_money"
  | "bank_transfer"
  | "voucher";
type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};
type CompletedSale = {
  saleId: string;
  receiptNo: string;
  createdAt: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessLogoSrc: string | null;
  invoiceFooter: string;
  cashierName: string;
  items: CartItem[];
  saleCurrency: string;
  subtotal: number;
  discountAmount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethodId;
  paymentCurrency: string;
  paymentAmount: number;
  paymentDateLabel: string | null;
  receiptQrCodeDataUri: string | null;
  cashReceived: number;
  change: number;
};
type NoticeTone = "success" | "info" | "warning" | "error";
type Notice = {
  id: number;
  tone: NoticeTone;
  message: string;
};
type DiscountType = "percent" | "fixed";
type ApprovalDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  requiredAbility: BusinessApproverAbility;
};
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Carte", icon: CreditCard },
  { id: "mobile_money", label: "Mobile", icon: Smartphone },
  { id: "bank_transfer", label: "Virement", icon: Landmark },
  { id: "voucher", label: "Bon", icon: Wallet },
];
function safeNumber(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `off-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function formatCacheTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR");
}
function getStringField(
  source: unknown,
  keys: string[],
  fallback = "",
): string {
  if (!source || typeof source !== "object") return fallback;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0)
      return value.trim();
  }
  return fallback;
}
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function formatBusinessAddress(settings: BusinessSettings | null): string {
  if (!settings) return "";
  const address = settings.address ?? {};
  const parts = [
    address.line1?.trim(),
    address.line2?.trim(),
    [address.city?.trim(), address.state?.trim()].filter(Boolean).join(", ") || undefined,
    address.zip?.trim(),
    address.country?.trim(),
  ].filter((value): value is string => Boolean(value && value.length > 0));

  return parts.join(", ");
}
function parsePaymentMethodIds(raw: string | null): PaymentMethodId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PaymentMethodId =>
        item === "cash" ||
        item === "card" ||
        item === "mobile_money" ||
        item === "bank_transfer" ||
        item === "voucher",
    );
  } catch {
    return [];
  }
}
function getConfiguredPaymentMethods(business: string): PaymentMethod[] {
  if (typeof window === "undefined") return DEFAULT_PAYMENT_METHODS;
  const ids = parsePaymentMethodIds(
    safeGetItem(`pos_payment_methods:${business}`),
  );
  if (ids.length === 0) return DEFAULT_PAYMENT_METHODS;
  const lookup = new Map(
    DEFAULT_PAYMENT_METHODS.map((item) => [item.id, item]),
  );
  const configured = ids
    .map((id) => lookup.get(id))
    .filter((item): item is PaymentMethod => Boolean(item));
  return configured.length > 0 ? configured : DEFAULT_PAYMENT_METHODS;
}
function normalizePaymentMethodId(value: string): PaymentMethodId | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "cash" || normalized === "especes") return "cash";
  if (
    normalized === "card" ||
    normalized === "carte" ||
    normalized === "credit_card"
  )
    return "card";
  if (
    normalized === "mobile_money" ||
    normalized === "mobile" ||
    normalized === "momo"
  )
    return "mobile_money";
  if (
    normalized === "bank_transfer" ||
    normalized === "transfer" ||
    normalized === "virement"
  )
    return "bank_transfer";
  if (
    normalized === "voucher" ||
    normalized === "bon" ||
    normalized === "coupon"
  )
    return "voucher";
  return null;
}
function mapApiPaymentMethods(
  configs: PosPaymentMethodConfig[],
): PaymentMethod[] {
  const iconById: Record<PaymentMethodId, PaymentMethod["icon"]> = {
    cash: Banknote,
    card: CreditCard,
    mobile_money: Smartphone,
    bank_transfer: Landmark,
    voucher: Wallet,
  };
  const mapped = configs
    .filter((item) => item.active)
    .map((item) => {
      const id = normalizePaymentMethodId(item.id);
      if (!id) return null;
      return {
        id,
        label:
          item.label ||
          DEFAULT_PAYMENT_METHODS.find((method) => method.id === id)?.label ||
          id,
        icon: iconById[id],
      } satisfies PaymentMethod;
    })
    .filter((item): item is PaymentMethod => Boolean(item));
  return mapped;
}
function fromApiParkedCart(cart: PosParkedCartApi): ParkedCart {
  return {
    id: cart.id,
    note: cart.note,
    createdAt: cart.createdAt,
    items: cart.items,
  };
}
function buildReceiptHtml(sale: CompletedSale): string {
  const linesHtml = sale.items
    .map((item) => {
      const lineGross = item.qty * item.price;
      const lineTotal = lineGross - computeItemDiscount(lineGross, item.discountType, item.discountValue);
      return `<tr><td><div class="item-name">${escapeHtml(item.name)}</div>${item.sku ? `<div class="item-meta">${escapeHtml(item.sku)}</div>` : ""}</td><td style="text-align:right">${escapeHtml(String(item.qty))} x ${escapeHtml(formatMoney(item.price, sale.saleCurrency))}</td><td style="text-align:right">${escapeHtml(formatMoney(lineTotal, sale.saleCurrency))}</td></tr>`;
    })
    .join("");
  const paymentLabel =
    DEFAULT_PAYMENT_METHODS.find((m) => m.id === sale.paymentMethod)?.label ??
    sale.paymentMethod;
  const paymentSummary = `<div class="row"><span>Montant regle</span><strong>${escapeHtml(formatMoney(sale.paymentAmount, sale.paymentCurrency))}</strong></div>`;
  const discountBlock =
    sale.discountAmount > 0
      ? `<div class="row"><span>Rabais</span><span>- ${escapeHtml(formatMoney(sale.discountAmount, sale.saleCurrency))}</span></div>`
      : "";
  const cashBlock =
    sale.paymentMethod === "cash"
      ? `<div class="row"><span>Recu</span><strong>${escapeHtml(formatMoney(sale.cashReceived, sale.paymentCurrency))}</strong></div><div class="row"><span>Monnaie</span><strong>${escapeHtml(formatMoney(sale.change, sale.paymentCurrency))}</strong></div>`
      : "";
  const logoBlock = sale.businessLogoSrc
    ? `<div class="logo-wrap"><img src="${sale.businessLogoSrc}" alt="Logo hotel" class="logo" /></div>`
    : "";
  const qrBlock = sale.receiptQrCodeDataUri
    ? `<div class="qr-card"><div class="qr-title">QR paiement</div><img src="${sale.receiptQrCodeDataUri}" alt="QR ticket" class="qr-image" /><div class="muted small">Scanner pour voir le business, le montant paye et la date.</div></div>`
    : "";
  const footerBlock = sale.invoiceFooter.trim()
    ? `<div class="footer-note">${escapeHtml(sale.invoiceFooter).replace(/\n/g, "<br />")}</div>`
    : "";
  const paymentDateLabel = sale.paymentDateLabel || new Date(sale.createdAt).toLocaleString("fr-FR");
  return `
<!doctype html>
<html><head><meta charset="utf-8" /><title>Ticket ${escapeHtml(sale.receiptNo)}</title><style>@page { size: 80mm auto; margin: 4mm; } body { font-family: Arial, sans-serif; font-size: 11px; width: 72mm; margin: 0 auto; color: #111827; } .center { text-align: center; } .muted { color: #6b7280; } .small { font-size: 9px; line-height: 1.35; } .sep { border-top: 1px dashed #9ca3af; margin: 8px 0; } .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; } .title { font-size: 14px; font-weight: 700; margin-bottom: 2px; } table { width: 100%; border-collapse: collapse; } td { padding: 3px 0; vertical-align: top; } .grand { font-size: 14px; font-weight: 800; } .logo-wrap { text-align: center; margin-bottom: 8px; } .logo { width: 56px; height: 56px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 12px; padding: 4px; background: #fff; } .header-card, .qr-card, .footer-note { border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px; background: #f8fafc; margin-bottom: 8px; } .item-name { font-weight: 700; } .item-meta { color: #6b7280; font-size: 9px; } .qr-title { text-transform: uppercase; letter-spacing: .08em; font-size: 9px; color: #475569; font-weight: 700; margin-bottom: 6px; text-align: center; } .qr-image { width: 96px; height: 96px; display: block; margin: 0 auto 6px; } .footer-note { font-size: 10px; line-height: 1.45; color: #334155; }</style></head><body><div class="center">${logoBlock}<div class="title">${escapeHtml(sale.businessName)}</div><div class="muted">${escapeHtml(sale.businessAddress || "")}</div><div class="muted">${escapeHtml(sale.businessPhone || "")}${sale.businessEmail ? ` | ${escapeHtml(sale.businessEmail)}` : ""}</div></div><div class="sep"></div><div class="header-card"><div class="row"><span>Ticket</span><strong>${escapeHtml(sale.receiptNo)}</strong></div><div class="row"><span>Date</span><span>${escapeHtml(paymentDateLabel)}</span></div><div class="row"><span>Caissier</span><span>${escapeHtml(sale.cashierName)}</span></div><div class="row"><span>Paiement</span><span>${escapeHtml(paymentLabel)}</span></div></div><table>${linesHtml}</table><div class="sep"></div><div class="row"><span>Sous-total</span><span>${escapeHtml(formatMoney(sale.subtotal, sale.saleCurrency))}</span></div>${discountBlock}<div class="row"><span>Taxes</span><span>${escapeHtml(formatMoney(sale.tax, sale.saleCurrency))}</span></div><div class="row grand"><span>Total</span><span>${escapeHtml(formatMoney(sale.total, sale.saleCurrency))}</span></div>${paymentSummary}${cashBlock}<div class="sep"></div>${footerBlock}${qrBlock}<div class="center muted">Merci et a bientot.</div></body></html>`;
}
function printReceipt(sale: CompletedSale) {
  const receiptWindow = window.open("", "_blank", "width=420,height=760");
  if (!receiptWindow) return;
  receiptWindow.document.open();
  receiptWindow.document.write(buildReceiptHtml(sale));
  receiptWindow.document.close();
  setTimeout(() => {
    receiptWindow.focus();
    receiptWindow.print();
  }, 250);
}
export default function PosPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const saleCurrency = "HTG";
  const { user, activeBusiness, permissions } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hiddenProductIds, setHiddenProductIds] = useState<
    Record<string, boolean>
  >({});
  const [productQtyById, setProductQtyById] = useState<Record<string, number>>(
    {},
  );
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
  const [useRemoteParked, setUseRemoteParked] = useState(false);
  const [parkNote, setParkNote] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    DEFAULT_PAYMENT_METHODS,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "HTG">("HTG");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [discountType, setDiscountType] = useState<"none" | DiscountType>("none");
  const [discountValueInput, setDiscountValueInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerItem[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [redeemPointsInput, setRedeemPointsInput] = useState("");
  const [discountEditorProductId, setDiscountEditorProductId] = useState<string | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastSale, setLastSale] = useState<CompletedSale | null>(null);
  const [defaultPrinter, setDefaultPrinter] = useState<PrinterItem | null>(null);
  const [openingDrawer, setOpeningDrawer] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState<ApprovalDialogState | null>(null);
  const [approvalApprovers, setApprovalApprovers] = useState<BusinessApproverItem[]>([]);
  const [approvalApproversLoading, setApprovalApproversLoading] = useState(false);
  const [offlineCatalogAt, setOfflineCatalogAt] = useState<string | null>(null);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [syncingSales, setSyncingSales] = useState(false);
  const isOnline = useOnlineStatus();
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashSessionLoading, setCashSessionLoading] = useState(true);
  const [showOpenRegisterForm, setShowOpenRegisterForm] = useState(false);
  const [openingAmounts, setOpeningAmounts] = useState<{ HTG: string; USD: string }>({ HTG: "0.00", USD: "0.00" });
  const [openingNoteInput, setOpeningNoteInput] = useState("");
  const [openingRegister, setOpeningRegister] = useState(false);
  const registerOpen = cashSession?.status === "open";
  const queryInputRef = useRef<HTMLInputElement | null>(null);
  const pushNotice = useCallback((message: string, tone: NoticeTone = "info") => {
    setNotice({ id: Date.now(), tone, message });
  }, []);
  const pushError = useCallback((message: string) => {
    setError(message);
    setNotice({ id: Date.now(), tone: "error", message });
  }, []);
  useEffect(() => {
    if (!businessSlug) return;
    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }
    let cancelled = false;
    setCustomerSearchLoading(true);
    const timer = window.setTimeout(() => {
      void listCustomers(businessSlug, { q: query, perPage: 8 })
        .then((res) => {
          if (!cancelled) setCustomerResults(res.items);
        })
        .catch(() => {
          if (!cancelled) setCustomerResults([]);
        })
        .finally(() => {
          if (!cancelled) setCustomerSearchLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [businessSlug, customerQuery]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice((prev) => (prev?.id === notice.id ? null : prev));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!approvalDialog || !businessSlug) return;

    let cancelled = false;
    setApprovalApproversLoading(true);
    setApprovalApprovers([]);

    void listBusinessApprovers(businessSlug, approvalDialog.requiredAbility)
      .then((items) => {
        if (!cancelled) {
          setApprovalApprovers(items);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          pushError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setApprovalApproversLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [approvalDialog, businessSlug, pushError]);
  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      if (!businessSlug) return;
      setLoadingProducts(true);
      setError("");
      try {
        const data = await getProducts(businessSlug);
        if (mounted) {
          setProducts(data);
          setOfflineCatalogAt(null);
        }
        void setCachedProducts(businessSlug, data);
      } catch (e) {
        const cached = await getCachedProducts(businessSlug);
        if (cached && mounted) {
          setProducts(cached.products);
          setOfflineCatalogAt(cached.cachedAt);
        } else if (mounted) {
          pushError(getErrorMessage(e));
        }
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    }
    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [businessSlug, pushError]);
  useEffect(() => {
    if (isOnline) return;
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerDropdownOpen(false);
    setRedeemPointsInput("");
    setAppliedCoupon(null);
    setCouponCodeInput("");
    setCouponError("");
  }, [isOnline]);
  useEffect(() => {
    if (!businessSlug) return;
    let mounted = true;
    function refreshPendingCount() {
      void listPendingSales(businessSlug).then((items) => {
        if (mounted) setPendingSalesCount(items.length);
      });
    }
    refreshPendingCount();
    async function runSync() {
      setSyncingSales(true);
      try {
        await syncPendingSales(businessSlug);
      } finally {
        if (mounted) setSyncingSales(false);
        refreshPendingCount();
      }
    }
    if (isOnline) void runSync();
    function handleOnline() {
      void runSync();
    }
    window.addEventListener("online", handleOnline);
    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessSlug]);
  useEffect(() => {
    if (!businessSlug) return;
    let mounted = true;
    setCashSessionLoading(true);
    getCurrentCashSession(businessSlug)
      .then((session) => {
        if (mounted) setCashSession(session);
      })
      .catch(() => {
        if (mounted) setCashSession(null);
      })
      .finally(() => {
        if (mounted) setCashSessionLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [businessSlug]);
  useEffect(() => {
    let mounted = true;
    async function loadBusinessConfig() {
      if (!businessSlug) return;
      try {
        const data = await getBusinessSettings(businessSlug);
        if (mounted) setBusinessSettings(data);
      } catch (e) {
        if (mounted) pushError(getErrorMessage(e));
      }
    }
    void loadBusinessConfig();
    return () => {
      mounted = false;
    };
  }, [businessSlug, pushError]);
  useEffect(() => {
    let mounted = true;
    async function loadDefaultPrinter() {
      if (!businessSlug) return;
      try {
        const items = await listPrinters(businessSlug);
        if (!mounted) return;
        setDefaultPrinter(items.find((item) => item.isDefault) ?? items[0] ?? null);
      } catch {
        // Aucune imprimante configuree : la caisse retombe sur l'impression navigateur.
      }
    }
    void loadDefaultPrinter();
    return () => {
      mounted = false;
    };
  }, [businessSlug]);
  useEffect(() => {
    let mounted = true;
    async function loadPaymentMethods() {
      if (!businessSlug) return;
      const localMethods = getConfiguredPaymentMethods(businessSlug);
      if (!mounted) return;
      setPaymentMethods(localMethods);
      setPaymentMethod((prev) =>
        localMethods.some((item) => item.id === prev)
          ? prev
          : (localMethods[0]?.id ?? "cash"),
      );
      try {
        const remote = await getPosPaymentMethods(businessSlug);
        if (!mounted || !remote) return;
        const mapped = mapApiPaymentMethods(remote);
        if (mapped.length === 0) return;
        setPaymentMethods(mapped);
        setPaymentMethod((prev) =>
          mapped.some((item) => item.id === prev) ? prev : mapped[0].id,
        );
      } catch (e) {
        if (mounted) pushError(getErrorMessage(e));
      }
    }
    void loadPaymentMethods();
    return () => {
      mounted = false;
    };
  }, [businessSlug, pushError]);
  useEffect(() => {
    let mounted = true;
    async function loadParkedCarts() {
      if (!businessSlug) return;
      try {
        const remote = await listPosParkedCarts(businessSlug);
        if (!mounted) return;
        if (remote) {
          setUseRemoteParked(true);
          setParkedCarts(remote.map(fromApiParkedCart));
          return;
        }
      } catch (e) {
        if (mounted) pushError(getErrorMessage(e));
      }
      if (!mounted) return;
      setUseRemoteParked(false);
      const raw = safeGetItem(`pos_parked_carts:${businessSlug}`);
      if (!raw) {
        setParkedCarts([]);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        setParkedCarts(Array.isArray(parsed) ? parsed : []);
      } catch {
        setParkedCarts([]);
      }
    }
    void loadParkedCarts();
    return () => {
      mounted = false;
    };
  }, [businessSlug, pushError]);
  function saveLocalParked(next: ParkedCart[]) {
    setParkedCarts(next);
    safeSetItem(
      `pos_parked_carts:${businessSlug}`,
      JSON.stringify(next),
    );
  }
  const getSaleUnitPrice = useCallback((product: CatalogProduct): number => {
    return convertAmount(product.price, product.priceCurrency, saleCurrency, {
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
    });
  }, [businessSettings, saleCurrency]);
  const categories = useMemo(() => {
    const values = Array.from(
      new Set(products.map((item) => item.category).filter(Boolean)),
    );
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [products]);
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((item) => {
      const matchQuery =
        normalized.length === 0 ||
        item.name.toLowerCase().includes(normalized) ||
        item.sku.toLowerCase().includes(normalized) ||
        item.barcode.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized);
      const matchCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      return matchQuery && matchCategory;
    });
  }, [products, query, categoryFilter]);
  const barcodeLookup = useMemo(() => {
    const lookup = new Map<string, CatalogProduct>();
    for (const product of products) {
      const barcode = product.barcode.trim().toLowerCase();
      if (barcode) {
        lookup.set(barcode, product);
      }
    }
    return lookup;
  }, [products]);
  useEffect(() => {
    if (cart.length === 0) {
      setHiddenProductIds((prev) =>
        Object.keys(prev).length === 0 ? prev : {},
      );
      return;
    }
    setHiddenProductIds((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of cart) {
        if (!next[item.productId]) {
          next[item.productId] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cart]);
  const visibleProducts = useMemo(
    () => filteredProducts.filter((item) => !hiddenProductIds[String(item.id)]),
    [filteredProducts, hiddenProductIds],
  );
  const itemDiscountTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + computeItemDiscount(item.qty * item.price, item.discountType, item.discountValue),
        0,
      ),
    [cart],
  );
  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          (item.qty * item.price -
            computeItemDiscount(item.qty * item.price, item.discountType, item.discountValue)),
        0,
      ),
    [cart],
  );
  const discountValue = safeNumber(discountValueInput);
  const discountAmount = useMemo(() => {
    if (discountType === "none" || subtotal <= 0 || discountValue <= 0) return 0;
    if (discountType === "percent") {
      return Number(Math.min(subtotal, (subtotal * discountValue) / 100).toFixed(2));
    }
    return Number(Math.min(subtotal, discountValue).toFixed(2));
  }, [discountType, discountValue, subtotal]);
  const taxTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.qty * item.price * (item.taxRate / 100),
        0,
      ),
    [cart],
  );
  const couponDiscountAmount = appliedCoupon?.discountAmount ?? 0;
  const grandTotal = Math.max(0, subtotal - discountAmount - couponDiscountAmount) + taxTotal;
  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart],
  );
  const canApplyDiscount = hasPermission(permissions, "billing.discount");
  useEffect(() => {
    if (!businessSlug || typeof window === "undefined") return;
    const storageKey = `pos_cart_count:${businessSlug}`;
    safeSetItem(storageKey, String(itemCount));
    window.dispatchEvent(
      new CustomEvent("pos-cart-count-changed", {
        detail: { business: businessSlug, count: itemCount },
      }),
    );
  }, [businessSlug, itemCount]);
  const loyaltyEnabled = Boolean(businessSettings?.loyalty_enabled);
  const loyaltyRedeemValue = businessSettings?.loyalty_redeem_value || 1;
  const loyaltyCapPercent = businessSettings?.loyalty_redemption_cap_percent ?? 50;
  const maxRedeemablePoints = useMemo(() => {
    if (!loyaltyEnabled || !selectedCustomer) return 0;
    const capAmount = (grandTotal * loyaltyCapPercent) / 100;
    const capPoints = Math.floor(capAmount / loyaltyRedeemValue);
    return Math.max(0, Math.min(selectedCustomer.loyaltyPointsBalance, capPoints));
  }, [grandTotal, loyaltyCapPercent, loyaltyEnabled, loyaltyRedeemValue, selectedCustomer]);
  const redeemPoints = Math.min(
    Math.max(0, Math.trunc(safeNumber(redeemPointsInput))),
    maxRedeemablePoints,
  );
  const pointsDiscountAmount = redeemPoints * loyaltyRedeemValue;
  const remainingAfterPoints = Math.max(0, grandTotal - pointsDiscountAmount);
  const amountDueInPaymentCurrency = useMemo(
    () =>
      convertAmount(remainingAfterPoints, saleCurrency, paymentCurrency, {
        exchangeRateDirection: businessSettings?.exchange_rate_direction,
        exchangeRateValue: businessSettings?.exchange_rate_value,
      }),
    [businessSettings, remainingAfterPoints, paymentCurrency, saleCurrency],
  );
  const cashReceived = safeNumber(cashReceivedInput);
  const cashDelta = cashReceived - amountDueInPaymentCurrency;
  const cashMissing = Math.max(-cashDelta, 0);
  const cashChange = Math.max(cashDelta, 0);
  function getProductRequestedQty(product: CatalogProduct): number {
    const raw = productQtyById[String(product.id)];
    const normalized = Number.isFinite(raw) ? Math.trunc(raw) : 1;
    return Math.max(1, normalized);
  }
  function updateProductRequestedQty(
    product: CatalogProduct,
    nextQtyRaw: number,
  ) {
    const productId = String(product.id);
    const normalized = Number.isFinite(nextQtyRaw) ? Math.trunc(nextQtyRaw) : 1;
    const maxQty =
      product.type === "service" ? 9999 : Math.max(1, product.stock);
    const nextQty = Math.min(maxQty, Math.max(1, normalized));
    setProductQtyById((prev) => ({ ...prev, [productId]: nextQty }));
  }
  const addToCart = useCallback((product: CatalogProduct, requestedQty = 1) => {
    const qtyToAdd = Math.max(1, Math.trunc(requestedQty || 1));
    if (!product.active || product.status === "archived") {
      pushError("Produit inactif: impossible a vendre.");
      return;
    }
    setError("");
    let qtyAdded = 0;
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === String(product.id),
      );
      const stockLimit =
        product.type === "service"
          ? Number.POSITIVE_INFINITY
          : Math.max(product.stock, 0);
      if (existing) {
        if (existing.qty + qtyToAdd > stockLimit) {
          pushError("Stock insuffisant pour ce produit.");
          return prev;
        }
        qtyAdded = qtyToAdd;
        return prev.map((item) =>
          item.productId === String(product.id)
            ? { ...item, qty: item.qty + qtyToAdd }
            : item,
        );
      }
      if (stockLimit < qtyToAdd) {
        pushError("Stock indisponible pour ce produit.");
        return prev;
      }
      qtyAdded = qtyToAdd;
      return [
        ...prev,
        {
          productId: String(product.id),
          name: product.name,
          sku: product.sku,
          price: getSaleUnitPrice(product),
          qty: qtyToAdd,
          type: product.type,
          stock: product.stock,
          taxRate: product.taxRate,
          imagePath: product.imagePath,
          currency: saleCurrency,
        },
      ];
    });
    if (qtyAdded > 0) {
      pushNotice(
        `${product.name} ajoute au panier (x${qtyAdded}).`,
        "success",
      );
    }
  }, [getSaleUnitPrice, pushError, pushNotice, saleCurrency]);
  const tryAddScannedProduct = useCallback((rawCode: string): boolean => {
    const normalized = rawCode.trim().toLowerCase();
    if (!normalized) return false;

    const found = barcodeLookup.get(normalized);
    if (!found) return false;

    addToCart(found, 1);
    setQuery("");
    window.setTimeout(() => {
      queryInputRef.current?.focus();
      queryInputRef.current?.select();
    }, 0);
    return true;
  }, [addToCart, barcodeLookup]);
  const handleCameraScan = useCallback((code: string) => {
    if (!tryAddScannedProduct(code)) {
      pushError(`Produit introuvable pour le code ${code}.`);
    }
  }, [pushError, tryAddScannedProduct]);
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 4) return;

    const timer = window.setTimeout(() => {
      void tryAddScannedProduct(normalized);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [query, tryAddScannedProduct]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      queryInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);
  function updateQty(productId: string, nextQty: number) {
    if (nextQty <= 0) {
      const current = cart.find((item) => item.productId === productId);
      if (current) pushNotice(`${current.name} retire du panier.`, "info");
    }
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.productId !== productId) return [item];
        if (nextQty <= 0) return [];
        if (item.type === "product" && nextQty > item.stock) {
          pushError("Stock insuffisant pour ce produit.");
          return [item];
        }
        return [{ ...item, qty: nextQty }];
      }),
    );
  }
  function removeLine(productId: string) {
    const current = cart.find((item) => item.productId === productId);
    if (current) pushNotice(`${current.name} retire du panier.`, "info");
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }
  function setLineDiscount(
    productId: string,
    discountType: "percent" | "fixed" | null,
    discountValue: number,
  ) {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, discountType, discountValue } : item,
      ),
    );
  }
  function clearCurrentCart() {
    setCart([]);
    setCashReceivedInput("");
    setDiscountType("none");
    setDiscountValueInput("");
    setDiscountEditorProductId(null);
    setError("");
  }
  async function parkCurrentCart() {
    if (cart.length === 0) {
      pushError("Le panier est vide.");
      return;
    }
    const parked: ParkedCart = {
      id: `P-${Date.now().toString(36).toUpperCase()}`,
      note: parkNote.trim() || `Panier ${parkedCarts.length + 1}`,
      createdAt: new Date().toISOString(),
      items: cart,
    };
    try {
      if (useRemoteParked) {
        const created = await createPosParkedCart(businessSlug, {
          note: parked.note,
          items: parked.items,
        });
        if (created) {
          setParkedCarts((prev) => [fromApiParkedCart(created), ...prev]);
        } else {
          const next = [parked, ...parkedCarts];
          saveLocalParked(next);
          setUseRemoteParked(false);
        }
      } else {
        const next = [parked, ...parkedCarts];
        saveLocalParked(next);
      }
      setCart([]);
      setParkNote("");
      setCashReceivedInput("");
      setError("");
      pushNotice(`Panier mis en attente: ${parked.note}.`, "info");
    } catch (e) {
      pushError(getErrorMessage(e));
    }
  }
  async function resumeParkedCart(parkId: string) {
    const found = parkedCarts.find((item) => item.id === parkId);
    if (!found) return;
    setCart(found.items);
    setParkNote(found.note ?? "");
    try {
      if (useRemoteParked) {
        const deleted = await deletePosParkedCart(businessSlug, parkId);
        if (!deleted) setUseRemoteParked(false);
      }
      const next = parkedCarts.filter((item) => item.id !== parkId);
      setParkedCarts(next);
      if (!useRemoteParked) saveLocalParked(next);
      setError("");
      pushNotice(`Panier repris: ${found.note}.`, "success");
    } catch (e) {
      pushError(getErrorMessage(e));
    }
  }
  async function discardParkedCart(parkId: string) {
    const found = parkedCarts.find((item) => item.id === parkId);
    try {
      if (useRemoteParked) {
        const deleted = await deletePosParkedCart(businessSlug, parkId);
        if (!deleted) setUseRemoteParked(false);
      }
      const next = parkedCarts.filter((item) => item.id !== parkId);
      setParkedCarts(next);
      if (!useRemoteParked) saveLocalParked(next);
      setError("");
      if (found) pushNotice(`Panier supprime: ${found.note}.`, "info");
    } catch (e) {
      pushError(getErrorMessage(e));
    }
  }
  async function printSaleReceipt(sale: CompletedSale) {
    if (!defaultPrinter || !businessSlug) {
      printReceipt(sale);
      return;
    }
    try {
      const result = await printReceiptOnPrinter(businessSlug, defaultPrinter.id, sale.saleId);
      if (result.printed) {
        pushNotice(`Ticket envoye a l'imprimante "${defaultPrinter.name}".`, "success");
        return;
      }
      if (!result.qzPrinterName) {
        throw new Error("Imprimante QZ non configuree.");
      }
      await printRawEscposViaQz(result.qzPrinterName, result.data);
      pushNotice(`Ticket envoye a l'imprimante "${defaultPrinter.name}" via QZ Tray.`, "success");
    } catch (e) {
      pushNotice(
        `Impression thermique impossible (${getErrorMessage(e)}), aperçu navigateur ouvert.`,
        "warning",
      );
      printReceipt(sale);
    }
  }
  async function handleOpenDrawer() {
    if (!defaultPrinter || !businessSlug) return;
    setOpeningDrawer(true);
    try {
      const result = await openCashDrawer(businessSlug, defaultPrinter.id);
      if (result.opened) {
        pushNotice("Tiroir-caisse ouvert.", "success");
        return;
      }
      if (!result.qzPrinterName) {
        throw new Error("Imprimante QZ non configuree.");
      }
      await printRawEscposViaQz(result.qzPrinterName, result.data);
      pushNotice("Tiroir-caisse ouvert via QZ Tray.", "success");
    } catch (e) {
      pushError(getErrorMessage(e));
    } finally {
      setOpeningDrawer(false);
    }
  }
  async function handleManualSync() {
    if (!businessSlug || syncingSales) return;
    setSyncingSales(true);
    try {
      await syncPendingSales(businessSlug);
      const remaining = await listPendingSales(businessSlug);
      setPendingSalesCount(remaining.length);
      if (remaining.length === 0) {
        pushNotice("Ventes hors-ligne synchronisees.", "success");
      } else {
        pushNotice(`${remaining.length} vente(s) hors-ligne restent a synchroniser.`, "warning");
      }
    } finally {
      setSyncingSales(false);
    }
  }
  async function handleOpenRegister() {
    if (!businessSlug || openingRegister) return;
    setOpeningRegister(true);
    try {
      const session = await openCashSession(businessSlug, {
        openingAmountByCurrency: {
          HTG: safeNumber(openingAmounts.HTG),
          USD: safeNumber(openingAmounts.USD),
        },
        openingNote: openingNoteInput.trim() || undefined,
      });
      setCashSession(session);
      setShowOpenRegisterForm(false);
      setOpeningNoteInput("");
      pushNotice("Caisse ouverte.", "success");
    } catch (e) {
      pushError(getErrorMessage(e));
    } finally {
      setOpeningRegister(false);
    }
  }
  async function handleApplyCoupon() {
    const code = couponCodeInput.trim();
    if (!businessSlug || !code) return;
    setCouponValidating(true);
    setCouponError("");
    try {
      const result = await validateCoupon(businessSlug, {
        code,
        subtotal,
        customerId: selectedCustomer?.id,
      });
      if (result.valid) {
        setAppliedCoupon({ code: result.coupon.code, discountAmount: result.discountAmount });
        setCouponCodeInput("");
        pushNotice(`Code promo ${result.coupon.code} applique.`, "success");
      } else {
        setCouponError(result.message);
      }
    } catch (e) {
      setCouponError(getErrorMessage(e));
    } finally {
      setCouponValidating(false);
    }
  }
  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError("");
  }
  async function runCheckoutSale(approval?: PosApprovalPayload): Promise<boolean> {
    if (cart.length === 0) {
      pushError("Ajoute des produits avant de passer a la caisse.");
      return false;
    }
    if (paymentMethod === "cash" && cashReceived < amountDueInPaymentCurrency) {
      pushError(`Montant insuffisant: manque ${formatMoney(cashMissing, paymentCurrency)}.`);
      return false;
    }
    setCheckoutLoading(true);
    setError("");
    const idempotencyKey = generateClientId();
    const checkoutInput: PosCheckoutInput = {
      cashierId: user?.id ?? undefined,
      customerId: selectedCustomer?.id ?? undefined,
      subtotal,
      tax: taxTotal,
      total: grandTotal,
      discountType: discountType === "none" ? null : discountType,
      discountValue: discountType === "none" ? 0 : discountValue,
      redeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
      couponCode: appliedCoupon?.code ?? undefined,
      idempotencyKey,
      paymentMethod,
      paymentCurrency,
      paymentAmount: amountDueInPaymentCurrency,
      cashReceived: paymentMethod === "cash" ? cashReceived : amountDueInPaymentCurrency,
      changeAmount: paymentMethod === "cash" ? cashChange : 0,
      approval,
      items: cart.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        unitPrice: item.price,
        taxRate: item.taxRate,
        type: item.type,
        name: item.name,
        sku: item.sku,
        discountType: item.discountType ?? null,
        discountValue: item.discountValue ?? 0,
      })),
    };
    function finishSale(backendResult: PosCheckoutResult | null, offline: boolean): CompletedSale {
      const businessName =
        backendResult?.businessName ||
        businessSettings?.legal_name ||
        businessSettings?.name ||
        getStringField(activeBusiness, ["name", "legal_name"], businessSlug.toUpperCase());
      const businessAddress =
        backendResult?.businessAddress || formatBusinessAddress(businessSettings);
      const businessPhone =
        backendResult?.businessPhone || businessSettings?.phone || "";
      const businessEmail =
        backendResult?.businessEmail || businessSettings?.email || "";
      const invoiceFooter =
        backendResult?.businessInvoiceFooter ||
        businessSettings?.invoice_footer ||
        "";
      const cashierName = getStringField(
        user,
        ["name", "full_name"],
        "Caissier",
      );
      const sale: CompletedSale = {
        saleId: backendResult?.saleId ?? "",
        receiptNo: offline
          ? `OFFLINE-${idempotencyKey.slice(0, 8)}`
          : (backendResult?.receiptNo ?? `TKT-${Date.now()}`),
        createdAt: backendResult?.createdAt ?? new Date().toISOString(),
        businessName,
        businessAddress,
        businessPhone,
        businessEmail,
        businessLogoSrc:
          backendResult?.businessLogoDataUri ||
          businessSettings?.logo_url ||
          null,
        invoiceFooter,
        cashierName,
        items: cart,
        saleCurrency,
        subtotal,
        discountAmount,
        tax: taxTotal,
        total: grandTotal,
        paymentMethod,
        paymentCurrency,
        paymentAmount: backendResult?.paymentAmount ?? amountDueInPaymentCurrency,
        paymentDateLabel:
          backendResult?.paymentDateLabel ||
          new Date(backendResult?.createdAt ?? new Date().toISOString()).toLocaleString("fr-FR"),
        receiptQrCodeDataUri: backendResult?.receiptQrCodeDataUri ?? null,
        cashReceived: paymentMethod === "cash" ? cashReceived : amountDueInPaymentCurrency,
        change: paymentMethod === "cash" ? cashChange : 0,
      };
      const storageKey = `pos_sales:${businessSlug}`;
      const existingRaw = safeGetItem(storageKey);
      const existing = existingRaw
        ? (JSON.parse(existingRaw) as CompletedSale[])
        : [];
      safeSetItem(storageKey, JSON.stringify([sale, ...existing]));
      setProducts((prev) =>
        prev.map((product) => {
          const line = cart.find(
            (item) => item.productId === String(product.id),
          );
          if (!line || product.type === "service") return product;
          return { ...product, stock: Math.max(0, product.stock - line.qty) };
        }),
      );
      setLastSale(sale);
      clearCurrentCart();
      if (offline) {
        pushNotice(`Vente enregistree hors-ligne. Ticket provisoire ${sale.receiptNo}.`, "warning");
      } else {
        pushNotice(`Vente terminee. Ticket ${sale.receiptNo}.`, "success");
        if (backendResult && backendResult.loyaltyPointsEarned > 0) {
          pushNotice(
            `${backendResult.loyaltyPointsEarned} points gagnes. Nouveau solde: ${backendResult.loyaltyPointsBalanceAfter ?? "?"}.`,
            "info",
          );
        }
      }
      setSelectedCustomer(null);
      setCustomerQuery("");
      setRedeemPointsInput("");
      setAppliedCoupon(null);
      setCouponCodeInput("");
      setCouponError("");
      void printSaleReceipt(sale);
      return sale;
    }
    try {
      const backendResult = await checkoutPosSale(businessSlug, checkoutInput);
      finishSale(backendResult, false);
      return true;
    } catch (e) {
      if (!(e instanceof ApiError)) {
        try {
          await enqueuePendingSale({
            id: idempotencyKey,
            business: businessSlug,
            payload: checkoutInput,
            status: "pending",
            error: null,
            createdAt: new Date().toISOString(),
            totalDisplay: grandTotal,
            currencyDisplay: saleCurrency,
          });
          finishSale(null, true);
          setPendingSalesCount((count) => count + 1);
          return true;
        } catch (queueError) {
          pushError(getErrorMessage(queueError));
          return false;
        }
      }
      pushError(getErrorMessage(e));
      return false;
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function checkoutSale() {
    if ((discountAmount > 0 || itemDiscountTotal > 0) && !canApplyDiscount) {
      setApprovalDialog({
        title: "Validation manager requise",
        description:
          "Ce rabais doit etre autorise par un manager ou un superviseur avant de finaliser la vente.",
        confirmLabel: "Autoriser le rabais",
        requiredAbility: "discount_billing",
      });
      return;
    }

    await runCheckoutSale();
  }
  return (
    <div className="space-y-6">
      {" "}
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        {" "}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {" "}
          <div>
            {" "}
            <h1 className="text-2xl font-bold text-slate-900">
              Nouvelle vente
            </h1>{" "}
            <p className="text-slate-500 text-sm mt-1">
              {" "}
              Caissier:{" "}
              <span className="font-semibold text-slate-700">
                {getStringField(user, ["name"], "Utilisateur")}
              </span>{" "}
            </p>{" "}
            {!isOnline ? (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                <AlertCircle className="h-3.5 w-3.5" />
                Mode hors-ligne
                {offlineCatalogAt ? ` - catalogue du ${formatCacheTimestamp(offlineCatalogAt)}` : ""}
              </p>
            ) : null}
          </div>{" "}
          <div className="flex items-center gap-2">
            {pendingSalesCount > 0 ? (
              <button
                onClick={() => void handleManualSync()}
                disabled={syncingSales || !isOnline}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {" "}
                {syncingSales
                  ? "Synchronisation..."
                  : `${pendingSalesCount} vente(s) en attente - Synchroniser maintenant`}{" "}
              </button>
            ) : null}
            {defaultPrinter?.cashDrawerEnabled ? (
              <button
                onClick={handleOpenDrawer}
                disabled={openingDrawer}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {" "}
                <Wallet className="h-4 w-4" />{" "}
                {openingDrawer ? "Ouverture..." : "Ouvrir le tiroir"}{" "}
              </button>
            ) : null}
            {lastSale ? (
              <button
                onClick={() => printSaleReceipt(lastSale)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {" "}
                <Printer className="h-4 w-4" /> Reimprimer dernier ticket{" "}
              </button>
            ) : null}{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
      {!cashSessionLoading && !registerOpen ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">La caisse est fermee</p>
                <p className="text-sm">Ouvrez la caisse pour pouvoir enregistrer une vente.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowOpenRegisterForm((prev) => !prev)}
              className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              {showOpenRegisterForm ? "Annuler" : "Ouvrir la caisse"}
            </button>
          </div>
          {showOpenRegisterForm ? (
            <div className="mt-4 space-y-3 border-t border-amber-200 pt-3">
              <p className="text-xs font-semibold text-amber-900">Fonds de depart</p>
              <div className="flex gap-3">
                {(["HTG", "USD"] as const).map((code) => (
                  <label key={code} className="flex-1 space-y-1 text-xs font-semibold text-amber-900">
                    {code}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingAmounts[code]}
                      onChange={(event) =>
                        setOpeningAmounts((prev) => ({ ...prev, [code]: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-amber-200 px-2 py-1.5 text-sm text-right"
                    />
                  </label>
                ))}
              </div>
              <label className="block text-xs font-semibold text-amber-900">
                Note (optionnel)
                <input
                  type="text"
                  value={openingNoteInput}
                  onChange={(event) => setOpeningNoteInput(event.target.value)}
                  placeholder="Ex: monnaie recue de la direction"
                  className="mt-1 w-full rounded-lg border border-amber-200 px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleOpenRegister()}
                disabled={openingRegister}
                className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {openingRegister ? "Ouverture..." : "Confirmer l'ouverture"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      {notice ? (
        <div className="pointer-events-none fixed right-4 top-20 z-[70] w-[min(92vw,360px)]">
          <section
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg transition-all duration-200 ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : notice.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : notice.tone === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="inline-flex items-center gap-2">
              {notice.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : notice.tone === "warning" || notice.tone === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : (
                <Info className="h-4 w-4 shrink-0" />
              )}
              <span>{notice.message}</span>
            </div>
          </section>
        </div>
      ) : null}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {" "}
        <section className="xl:col-span-2 space-y-4">
          {" "}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            {" "}
            <div className="relative">
              {" "}
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />{" "}
              <input
                ref={queryInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  if (tryAddScannedProduct(query)) {
                    event.preventDefault();
                  }
                }}
                placeholder="Scanner ou rechercher un produit (nom, SKU, code-barres, categorie)"
                className="w-full rounded-xl border border-slate-300 pl-9 pr-11 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                title="Scanner avec la camera"
                aria-label="Scanner avec la camera"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>{" "}
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full md:w-72 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {" "}
              <option value="all">Toutes les categories</option>{" "}
              {categories.map((category) => (
                <option key={category} value={category}>
                  {" "}
                  {category}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </div>{" "}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            {" "}
            {loadingProducts ? (
              <div className="py-10 text-center text-slate-500">
                Chargement des produits...
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                Aucun produit trouve.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {" "}
                {visibleProducts.map((product) => {
                  const productId = String(product.id);
                  const imageSrc = brokenImages[productId]
                    ? DEFAULT_PRODUCT_AVATAR_PATH
                    : resolveProductImageUrl(product.imagePath);
                  const canSell =
                    product.active &&
                    (product.type === "service" || product.stock > 0);
                  const requestedQty = getProductRequestedQty(product);
                  const maxRequestedQty =
                    product.type === "service" ? 9999 : Math.max(1, product.stock);
                  return (
                    <article
                      key={productId}
                      className={`rounded-xl border p-2 space-y-1.5 ${canSell ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-80"}`}
                    >
                      {" "}
                      <div className="flex flex-col items-start justify-between gap-2">
                        <div className="w-full flex justify-end">
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 sm:px-2 sm:text-[11px]">
                          {" "}
                          {product.type}{" "}
                        </span>{" "}
                        </div>
                        {" "}
                        <div className="min-w-0 w-full flex flex-col gap-1.5">
                           <div className="min-w-0">
                            {" "}
                            <h3 className="truncate text-[11px] font-semibold text-slate-800 sm:text-xs">
                              {product.name}
                            </h3>{" "}
                            <p className="truncate text-[10px] text-slate-500">
                              {product.sku}
                            </p>{" "}
                          </div>
                          <div className="w-full flex items-center justify-center">
                          <div className="relative flex w-full min-h-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 sm:min-h-28">
                            <Image
                              src={imageSrc}
                              alt={product.name}
                              fill
                              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                              className="h-full w-full object-cover"
                              unoptimized
                              onError={() => {
                                setBrokenImages((prev) => ({
                                  ...prev,
                                  [productId]: true,
                                }));
                              }}
                            />
                          </div>
                         </div>
                        </div>{" "}
                        
                      </div>{" "}
                      <div className="flex min-w-0 items-center justify-between gap-1">
                        <div className="min-w-0 pr-1">
                          <div className="truncate text-[11px] font-bold text-slate-900 sm:text-xs">
                            {formatMoney(product.price, product.priceCurrency)}
                          </div>
                          {product.priceCurrency !== saleCurrency ? (
                            <div className="truncate text-[10px] text-slate-500">
                              Facture: {formatMoney(getSaleUnitPrice(product), saleCurrency)}
                            </div>
                          ) : null}
                        </div>{" "}
                        <div className="inline-flex shrink-0 items-center gap-0.5 sm:gap-1">
                          <button
                            onClick={() =>
                              updateProductRequestedQty(product, requestedQty - 1)
                            }
                            disabled={!canSell || requestedQty <= 1}
                            className="h-5 w-5 sm:h-7 sm:w-7 inline-flex items-center justify-center rounded-md sm:rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Diminuer quantite"
                          >
                            {" "}
                            <Minus className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />{" "}
                          </button>{" "}
                          <span className="w-5 sm:w-8 text-center text-[11px] sm:text-sm font-semibold">
                            {requestedQty}
                          </span>{" "}
                          <button
                            onClick={() =>
                              updateProductRequestedQty(product, requestedQty + 1)
                            }
                            disabled={
                              !canSell ||
                              (product.type === "product" &&
                                requestedQty >= maxRequestedQty)
                            }
                            className="h-5 w-5 sm:h-7 sm:w-7 inline-flex items-center justify-center rounded-md sm:rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Augmenter quantite"
                          >
                            {" "}
                            <Plus className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />{" "}
                          </button>{" "}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {" "}
                        Stock:{" "}
                        {product.type === "service" ? "N/A" : product.stock} |
                        Cat: {product.category}{" "}
                      </div>{" "}
                      <button
                        onClick={() => addToCart(product, requestedQty)}
                        disabled={!canSell}
                        className="w-full rounded-lg brand-primary-btn py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {" "}
                        Ajouter au panier{" "}
                      </button>{" "}
                    </article>
                  );
                })}{" "}
              </div>
            )}{" "}
          </div>{" "}
        </section>{" "}
        <aside id="pos-cart-section" className="space-y-4">
          {" "}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            {" "}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              {" "}
              <div className="font-bold text-slate-900">Panier</div>{" "}
              <div className="text-sm text-slate-500">
                {itemCount} article(s)
              </div>{" "}
            </div>{" "}
            <div className="p-4 space-y-3 max-h-[320px] overflow-y-auto">
              {" "}
              {cart.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-6">
                  Panier vide
                </div>
              ) : (
                cart.map((item) => {
                  const imageSrc = brokenImages[item.productId]
                    ? DEFAULT_PRODUCT_AVATAR_PATH
                    : resolveProductImageUrl(item.imagePath);
                  const lineGross = item.qty * item.price;
                  const lineDiscount = computeItemDiscount(lineGross, item.discountType, item.discountValue);
                  const lineNet = lineGross - lineDiscount;
                  const discountEditorOpen = discountEditorProductId === item.productId;

                  return (
                  <div
                    key={item.productId}
                    className="rounded-xl border border-slate-200 p-3 space-y-2"
                  >
                    {" "}
                    <div className="flex items-start justify-between gap-3">
                      {" "}
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          <Image
                            src={imageSrc}
                            alt={item.name}
                            fill
                            sizes="36px"
                            className="h-full w-full object-cover"
                            unoptimized
                            onError={() => {
                              setBrokenImages((prev) => ({
                                ...prev,
                                [item.productId]: true,
                              }));
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          {" "}
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {item.name}
                          </div>{" "}
                          <div className="text-xs text-slate-500">
                            {item.sku}
                          </div>{" "}
                        </div>
                      </div>{" "}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setDiscountEditorProductId(discountEditorOpen ? null : item.productId)
                          }
                          className={`hover:text-indigo-700 ${lineDiscount > 0 ? "text-indigo-600" : "text-slate-400"}`}
                          title="Remise sur cet article"
                        >
                          <Tag className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeLine(item.productId)}
                          className="text-rose-600 hover:text-rose-700"
                          title="Retirer"
                        >
                          {" "}
                          <Trash2 className="h-4 w-4" />{" "}
                        </button>{" "}
                      </div>
                    </div>{" "}
                    {discountEditorOpen ? (
                      <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2">
                        <select
                          value={item.discountType ?? "none"}
                          onChange={(event) => {
                            const nextType =
                              event.target.value === "percent" || event.target.value === "fixed"
                                ? event.target.value
                                : null;
                            setLineDiscount(item.productId, nextType, item.discountValue ?? 0);
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        >
                          <option value="none">Aucune remise</option>
                          <option value="percent">%</option>
                          <option value="fixed">{saleCurrency}</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!item.discountType}
                          value={item.discountValue ? String(item.discountValue) : ""}
                          onChange={(event) =>
                            setLineDiscount(
                              item.productId,
                              item.discountType ?? null,
                              safeNumber(event.target.value),
                            )
                          }
                          placeholder="0"
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100"
                        />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between">
                      {" "}
                      <div className="inline-flex items-center gap-1">
                        {" "}
                        <button
                          onClick={() =>
                            updateQty(item.productId, item.qty - 1)
                          }
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          {" "}
                          <Minus className="h-3.5 w-3.5" />{" "}
                        </button>{" "}
                        <span className="w-8 text-center text-sm font-semibold">
                          {item.qty}
                        </span>{" "}
                        <button
                          onClick={() =>
                            updateQty(item.productId, item.qty + 1)
                          }
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          {" "}
                          <Plus className="h-3.5 w-3.5" />{" "}
                        </button>{" "}
                      </div>{" "}
                      <div className="text-right">
                        {lineDiscount > 0 ? (
                          <div className="text-xs text-slate-400 line-through">
                            {formatMoney(lineGross, saleCurrency)}
                          </div>
                        ) : null}
                        <div className="text-sm font-bold text-slate-900">
                          {formatMoney(lineNet, saleCurrency)}
                        </div>
                      </div>{" "}
                    </div>{" "}
                  </div>
                  );
                })
              )}{" "}
            </div>{" "}
            <div className="p-4 border-t space-y-1 text-sm">
              {" "}
              <div className="flex justify-between text-slate-600">
                {" "}
                <span>Sous-total</span>{" "}
                <span>{formatMoney(subtotal, saleCurrency)}</span>{" "}
              </div>{" "}
              {itemDiscountTotal > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  {" "}
                  <span>Remise articles</span>{" "}
                  <span>- {formatMoney(itemDiscountTotal, saleCurrency)}</span>{" "}
                </div>
              ) : null}{" "}
              <div className="flex justify-between text-slate-600">
                {" "}
                <span>Taxes</span> <span>{formatMoney(taxTotal, saleCurrency)}</span>{" "}
              </div>{" "}
              {discountAmount > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  {" "}
                  <span>Rabais</span> <span>- {formatMoney(discountAmount, saleCurrency)}</span>{" "}
                </div>
              ) : null}{" "}
              {couponDiscountAmount > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  {" "}
                  <span>Code promo ({appliedCoupon?.code})</span>{" "}
                  <span>- {formatMoney(couponDiscountAmount, saleCurrency)}</span>{" "}
                </div>
              ) : null}{" "}
              <div className="flex justify-between text-lg font-bold text-slate-900 pt-1">
                {" "}
                <span>Total</span> <span>{formatMoney(grandTotal, saleCurrency)}</span>{" "}
              </div>{" "}
            </div>{" "}
          </section>{" "}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            {" "}
            <div className="font-bold text-slate-900">Paiement</div>{" "}
            <div className="space-y-1.5 relative">
              <label className="text-sm font-medium text-slate-700">Client</label>
              {!isOnline ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                  <UserRound className="h-4 w-4 shrink-0 text-slate-300" />
                  Indisponible hors-ligne (client comptoir)
                </div>
              ) : selectedCustomer ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-300 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {selectedCustomer.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setRedeemPointsInput("");
                    }}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label="Retirer le client"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <UserRound className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={customerQuery}
                    onChange={(event) => {
                      setCustomerQuery(event.target.value);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onBlur={() => window.setTimeout(() => setCustomerDropdownOpen(false), 150)}
                    placeholder="Rechercher un client (optionnel - client comptoir par defaut)"
                    className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  {customerDropdownOpen && customerQuery.trim().length >= 2 ? (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {customerSearchLoading ? (
                        <div className="px-3 py-2.5 text-sm text-slate-500">Recherche...</div>
                      ) : customerResults.length === 0 ? (
                        <div className="px-3 py-2.5 text-sm text-slate-500">Aucun client trouve.</div>
                      ) : (
                        customerResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(item);
                              setCustomerDropdownOpen(false);
                              setCustomerQuery("");
                            }}
                            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                          >
                            <div className="font-semibold text-slate-800">{item.name}</div>
                            {item.phone ? <div className="text-xs text-slate-500">{item.phone}</div> : null}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>{" "}
            {loyaltyEnabled && selectedCustomer && isOnline ? (
              <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-sm text-amber-900">
                  <Star className="h-4 w-4" />
                  <span>
                    {selectedCustomer.loyaltyPointsBalance} points disponibles (~
                    {formatMoney(selectedCustomer.loyaltyPointsBalance * loyaltyRedeemValue, saleCurrency)})
                  </span>
                </div>
                {maxRedeemablePoints > 0 ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-amber-900">
                      Points a utiliser (max {maxRedeemablePoints})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={maxRedeemablePoints}
                      step="1"
                      value={redeemPointsInput}
                      onChange={(event) => setRedeemPointsInput(event.target.value)}
                      className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}{" "}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Rabais</label>
                <select
                  value={discountType}
                  onChange={(event) =>
                    setDiscountType(
                      event.target.value === "percent" || event.target.value === "fixed"
                        ? event.target.value
                        : "none",
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="none">Aucun</option>
                  <option value="percent">Pourcentage</option>
                  <option value="fixed">Montant fixe</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Valeur du rabais {discountType === "percent" ? "(%)" : `(${saleCurrency})`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValueInput}
                  onChange={(event) => setDiscountValueInput(event.target.value)}
                  disabled={discountType === "none"}
                  placeholder={discountType === "percent" ? "10" : "0.00"}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>
            {discountAmount > 0 ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                Rabais applique: {formatMoney(discountAmount, saleCurrency)}
                {!canApplyDiscount ? " - validation manager requise a la confirmation." : ""}
              </div>
            ) : null}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Code promo</label>
              {!isOnline ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                  Indisponible hors-ligne
                </div>
              ) : appliedCoupon ? (
                <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5">
                  <span className="text-sm font-semibold text-indigo-800">
                    {appliedCoupon.code} (- {formatMoney(appliedCoupon.discountAmount, saleCurrency)})
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-indigo-600 hover:text-indigo-800"
                    aria-label="Retirer le code promo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponCodeInput}
                    onChange={(event) => setCouponCodeInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleApplyCoupon();
                      }
                    }}
                    placeholder="Code promo"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => void handleApplyCoupon()}
                    disabled={couponValidating || !couponCodeInput.trim()}
                    className="shrink-0 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {couponValidating ? "..." : "Appliquer"}
                  </button>
                </div>
              )}
              {couponError ? <div className="text-xs text-rose-600">{couponError}</div> : null}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Devise de paiement
              </label>
              <select
                value={paymentCurrency}
                onChange={(event) =>
                  setPaymentCurrency(event.target.value === "USD" ? "USD" : "HTG")
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="HTG">HTG</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>{" "}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
              <div>Total facture: {formatMoney(grandTotal, saleCurrency)}</div>
              {couponDiscountAmount > 0 ? (
                <div className="mt-1">
                  Code promo: - {formatMoney(couponDiscountAmount, saleCurrency)}
                </div>
              ) : null}
              {pointsDiscountAmount > 0 ? (
                <div className="mt-1">
                  Points utilises: - {formatMoney(pointsDiscountAmount, saleCurrency)}
                </div>
              ) : null}
              <div className="mt-1">
                A encaisser: {formatMoney(amountDueInPaymentCurrency, paymentCurrency)}
              </div>
            </div>{" "}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Moyen de paiement</label>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethodId)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>{" "}
            {paymentMethod === "cash" ? (
              <div className="space-y-2 pt-1">
                {" "}
                <label className="text-sm font-medium text-slate-700">
                  Montant recu du client ({paymentCurrency})
                </label>{" "}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceivedInput}
                  onChange={(event) => setCashReceivedInput(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />{" "}
                {cashReceivedInput.trim() !== "" ? (
                  <div
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${cashDelta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {" "}
                    {cashDelta >= 0
                      ? `Monnaie a remettre: ${formatMoney(cashChange, paymentCurrency)}`
                      : `Montant manquant: ${formatMoney(cashMissing, paymentCurrency)}`}{" "}
                  </div>
                ) : null}{" "}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                Le client reglera {formatMoney(amountDueInPaymentCurrency, paymentCurrency)} via{" "}
                {paymentMethods.find((method) => method.id === paymentMethod)?.label || paymentMethod}.
              </div>
            )}{" "}
            {!cashSessionLoading && !registerOpen ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                Caisse fermee - ouvrez-la ci-dessus pour pouvoir encaisser.
              </div>
            ) : null}
            <button
              onClick={() => {
                void checkoutSale();
              }}
              disabled={checkoutLoading || cart.length === 0 || cashSessionLoading || !registerOpen}
              className="w-full rounded-xl brand-primary-btn text-white py-3 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {" "}
              {checkoutLoading ? "Traitement..." : "Passer a la caisse"}{" "}
            </button>{" "}
          </section>{" "}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            {" "}
            <div className="font-bold text-slate-900">
              Panier en attente
            </div>{" "}
            <input
              value={parkNote}
              onChange={(event) => setParkNote(event.target.value)}
              placeholder="Note (ex: Client table 5)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
            <button
              onClick={() => {
                void parkCurrentCart();
              }}
              disabled={cart.length === 0}
              className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {" "}
              <PauseCircle className="h-4 w-4" /> Mettre le panier en
              attente{" "}
            </button>{" "}
            {parkedCarts.length > 0 ? (
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {" "}
                {parkedCarts.map((parked) => (
                  <div
                    key={parked.id}
                    className="rounded-xl border border-slate-200 p-2.5"
                  >
                    {" "}
                    <div className="text-sm font-semibold text-slate-800">
                      {parked.note}
                    </div>{" "}
                    <div className="text-xs text-slate-500">
                      {" "}
                      {parked.items.reduce(
                        (sum, item) => sum + item.qty,
                        0,
                      )}{" "}
                      article(s) -{" "}
                      {new Date(parked.createdAt).toLocaleTimeString(
                        "fr-FR",
                      )}{" "}
                    </div>{" "}
                    <div className="mt-2 flex items-center gap-2">
                      {" "}
                      <button
                        onClick={() => {
                          void resumeParkedCart(parked.id);
                        }}
                        className="flex-1 rounded-lg brand-primary-btn text-white text-xs font-semibold py-1.5 inline-flex items-center justify-center gap-1"
                      >
                        {" "}
                        <PlayCircle className="h-3.5 w-3.5" /> Reprendre{" "}
                      </button>{" "}
                      <button
                        onClick={() => {
                          void discardParkedCart(parked.id);
                        }}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        {" "}
                        Suppr{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>
                ))}{" "}
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Aucun panier en attente.
              </div>
            )}{" "}
          </section>{" "}
        </aside>{" "}
      </div>{" "}
      <SensitiveActionApprovalModal
        open={Boolean(approvalDialog)}
        title={approvalDialog?.title ?? "Autorisation requise"}
        description={approvalDialog?.description ?? ""}
        confirmLabel={approvalDialog?.confirmLabel ?? "Autoriser"}
        loading={checkoutLoading}
        approvers={approvalApprovers}
        approversLoading={approvalApproversLoading}
        onClose={() => {
          if (!checkoutLoading) {
            setApprovalDialog(null);
            setApprovalApprovers([]);
          }
        }}
        onConfirm={async (approval: SensitiveActionApproval) => {
          const success = await runCheckoutSale(approval);
          if (success) {
            setApprovalDialog(null);
            setApprovalApprovers([]);
          }
        }}
      />
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetect={handleCameraScan}
        continuous
        title="Scanner un produit"
      />
    </div>
  );
}
