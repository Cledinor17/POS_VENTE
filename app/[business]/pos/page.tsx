"use client";
import { useSearchFromUrl } from "@/lib/useSearchFromUrl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { pricePosCart } from "@/lib/posCurrency";
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
import ParkedCartsPanel from "@/components/pos/ParkedCartsPanel";
import SensitiveActionApprovalModal, {
  type SensitiveActionApproval,
} from "@/components/SensitiveActionApprovalModal";
import { useBranch } from "@/context/BranchContext";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { getPosSettings, type BusinessSettings } from "@/lib/businessApi";
import { hasPermission } from "@/lib/businessAccess";
import { listCustomers, type CustomerItem } from "@/lib/customersApi";
import { validateCoupon } from "@/lib/couponsApi";
import {
  buildProductScanIndex,
  resolveScannedProduct,
} from "@/lib/productBarcode";
import { printReceipt, type PosReceipt } from "@/lib/posReceipt";
import { listPrintTemplates } from "@/lib/printTemplatesApi";
import { defaultPrintTemplate, safePrintTemplate, type PrintPaper, type PrintTemplate } from "@/lib/printTemplateModel";
import { receiptLabels } from "@/lib/receiptI18n";
import { posCompactLabels } from "@/lib/posCompactI18n";
import { listUnpostedDeposits, recordUnpostedDeposit,
  type UnpostedDepositMemo, type UnpostedDepositSummary } from "@/lib/posDepositMemosApi";
import { parseDepositAmount } from "@/lib/posDepositMemoUtils";
import { mergeParkedForBranch, visibleParkedForBranch } from "@/lib/posParkedBranchStorage";
import { useAppLocale } from "@/context/LocaleContext";
import {
  listBusinessApprovers,
  type BusinessApproverAbility,
  type BusinessApproverItem,
} from "@/lib/businessUsersApi";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import { getExchangeRate, convertAmount, convertPayment, formatMoney } from "@/lib/currency";
import {
  DEFAULT_PRODUCT_AVATAR_PATH,
  resolveProductImageUrl,
} from "@/lib/productImage";
import {
  checkoutPosSale,
  createPosParkedCart,
  updatePosParkedCart,
  setPosParkedDeposit,
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
import { enqueuePendingSale, getCachedProducts, listPendingSales, removePendingSale, setCachedProducts } from "@/lib/offlineDb";
import { syncPendingSales } from "@/lib/offlineSync";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { getCurrentCashSession, openCashSession, type CashSession } from "@/lib/cashSessionApi";
import { isNetworkUnavailable, offlineScopeKey, readOfflineValue, rememberOfflineValue, removeOfflineValue } from "@/lib/offlineAccess";

type CartItem = {
  discountCurrency?: string;
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
  branchId?: string;
  note: string;
  createdAt: string;
  items: CartItem[];
  version?: number;
  depositTotals?: { HTG: number; USD: number };
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
type CompletedSale = PosReceipt;
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
    version: cart.version,
    depositTotals: cart.depositTotals,
  };
}
export default function PosPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const { user, activeBusiness, permissions } = useAuth();
  const { locale } = useAppLocale();
  const receiptText = receiptLabels(locale);
  const ui = posCompactLabels(locale);
  const { currentBranch, loading: branchLoading } = useBranch();
  const branchId = currentBranch?.id;
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState("");
  useSearchFromUrl(setQuery);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productPageSelection, setProductPageSelection] = useState({ key: "", page: 1 });
  const [sourceCart, setCart] = useState<CartItem[]>([]);
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "HTG">("HTG");
  const pricedCart = useMemo(() => pricePosCart(sourceCart, paymentCurrency, businessSettings?.currency || "HTG", {
      exchangeBuyRate: businessSettings?.exchange_buy_rate, exchangeSellRate: businessSettings?.exchange_sell_rate,
      exchangeRateDirection: businessSettings?.exchange_rate_direction, exchangeRateValue: businessSettings?.exchange_rate_value,
    }), [sourceCart, paymentCurrency, businessSettings]);
  const saleCurrency = pricedCart.currency;
  const cart = pricedCart.items;
  const [hiddenProductIds, setHiddenProductIds] = useState<
    Record<string, boolean>
  >({});
  const [productQtyById, setProductQtyById] = useState<Record<string, number>>(
    {},
  );
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
  const [activeParked, setActiveParked] = useState<ParkedCart | null>(null);
  const [useRemoteParked, setUseRemoteParked] = useState(false);
  const [parkNote, setParkNote] = useState("");
  const [parkModalOpen, setParkModalOpen] = useState(false);
  const [parkSaving, setParkSaving] = useState(false);
  const parkCreateId = useRef<string | null>(null);
  const checkoutRequestKey = useRef<string | null>(null);
  const [parkDepositInput, setParkDepositInput] = useState("");
  const [parkDepositCurrency, setParkDepositCurrency] = useState<"HTG" | "USD">("HTG");
  const [depositDrafts, setDepositDrafts] = useState<Record<string, { amount: string; currency: "HTG" | "USD"; requestKey?: string }>>({});
  const [deposits, setDeposits] = useState<UnpostedDepositMemo[]>([]);
  const [depositTotals, setDepositTotals] = useState<UnpostedDepositSummary["totals"]>({ HTG: "0.00", USD: "0.00" });
  const [depositReadStatus, setDepositReadStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [depositMemosComplete, setDepositMemosComplete] = useState(false);
  const [depositSavingId, setDepositSavingId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<ParkedCart | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    DEFAULT_PAYMENT_METHODS,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [discountType, setDiscountType] = useState<"none" | DiscountType>("none");
  const [discountValueInput, setDiscountValueInput] = useState("");
  const [discountCurrency, setDiscountCurrency] = useState("HTG");
  const previousSaleCurrency = useRef(saleCurrency);
  useEffect(() => {
    if (previousSaleCurrency.current !== saleCurrency) {
      setAppliedCoupon(null);
      previousSaleCurrency.current = saleCurrency;
    }
  }, [saleCurrency]);
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
  const [printStyles, setPrintStyles] = useState<Record<PrintPaper, PrintTemplate>>({
    "58mm": defaultPrintTemplate("58mm"),
    "80mm": defaultPrintTemplate("80mm"),
    "a4": defaultPrintTemplate("a4"),
  });
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
        // The cashier needs the entire catalogue of the active branch for
        // local name/SKU/category search, barcode scanning and offline sales.
        // Without all=true Laravel returns only its first ten products.
        const data = await getProducts(businessSlug, { all: true });
        if (mounted) {
          setProducts(data);
          setOfflineCatalogAt(null);
        }
        if (branchId) void setCachedProducts(businessSlug, branchId, data);
      } catch (e) {
        const cached = branchId ? await getCachedProducts(businessSlug, branchId) : null;
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
  }, [businessSlug, branchId, pushError]);
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
    if (!businessSlug || !user?.id) return;
    let mounted = true;
    function refreshPendingCount() {
      void listPendingSales(businessSlug).then((items) => {
        if (mounted) setPendingSalesCount(items.filter((sale) => String(sale.payload.cashierId) === String(user?.id)).length);
      }).catch((error) => { if (mounted) pushError(getErrorMessage(error)); });
    }
    refreshPendingCount();
    async function runSync() {
      setSyncingSales(true);
      try {
        await syncPendingSales(businessSlug, { userId: String(user?.id ?? "") });
      } catch (error) {
        if (mounted) pushError(getErrorMessage(error));
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
  }, [businessSlug, user?.id]);
  useEffect(() => {
    // A cached cash session is bound to the exact cashier AND branch. No
    // fallback is permitted after an HTTP 401/403/422 or a known closed session.
    if (!businessSlug || user?.id == null || !branchId || branchLoading) {
      setCashSession(null);
      setCashSessionLoading(true);
      return;
    }
    let mounted = true;
    const cacheKey = offlineScopeKey("cash-session", businessSlug, user.id, branchId);
    setCashSession(null);
    setCashSessionLoading(true);
    getCurrentCashSession(businessSlug)
      .then((session) => {
        if (!mounted) return;
        setCashSession(session);
        if (session?.status === "open") rememberOfflineValue(cacheKey, session);
        else removeOfflineValue(cacheKey);
      })
      .catch((error) => {
        if (!mounted) return;
        const cached = isNetworkUnavailable(error) ? readOfflineValue<CashSession>(cacheKey) : null;
        setCashSession(cached?.status === "open" && String(cached.userId) === String(user.id)
          ? cached : null);
      })
      .finally(() => {
        if (mounted) setCashSessionLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [businessSlug, branchId, branchLoading, user?.id, isOnline]);
  useEffect(() => {
    let mounted = true;
    async function loadBusinessConfig() {
      if (!businessSlug || user?.id == null || !branchId) return;
      const cacheKey = offlineScopeKey("pos-settings", businessSlug, user.id, branchId);
      setBusinessSettings(null);
      try {
        const data = await getPosSettings(businessSlug);
        if (mounted) {
          setBusinessSettings(data);
          rememberOfflineValue(cacheKey, data);
        }
      } catch (error) {
        if (!mounted) return;
        const cached = isNetworkUnavailable(error)
          ? readOfflineValue<BusinessSettings>(cacheKey) : null;
        if (cached) {
          setBusinessSettings(cached);
        } else {
          pushError(getErrorMessage(error));
        }
      }
    }
    void loadBusinessConfig();
    return () => {
      mounted = false;
    };
  }, [businessSlug, branchId, user?.id, pushError, isOnline]);
  useEffect(() => {
    let active = true;
    if (!businessSlug) return undefined;
    const key = `pos_print_templates:${businessSlug}:${user?.id ?? "anonymous"}`;
    const cached = safeGetItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Partial<Record<PrintPaper, PrintTemplate>>;
        if (active) setPrintStyles({
          "58mm": safePrintTemplate(parsed["58mm"], "58mm"),
          "80mm": safePrintTemplate(parsed["80mm"], "80mm"),
          a4: safePrintTemplate(parsed.a4, "a4"),
        });
      } catch { /* Invalid offline print style must not stop sales. */ }
    }
    void listPrintTemplates(businessSlug).then(data => {
      if (!active) return;
      setPrintStyles(data.effective);
      safeSetItem(key, JSON.stringify(data.effective));
    }).catch(() => {
      // Keep the previous offline print style if the API is unavailable.
    });
    return () => { active = false; };
  }, [businessSlug, user?.id]);

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
      if (!businessSlug || !branchId || branchLoading) return;
      try {
        const remote = await listPosParkedCarts(businessSlug);
        if (!mounted) return;
        if (remote) {
          setUseRemoteParked(true);
          // Migrate older browser-only slips without changing their original
          // reference: their existing memo deposits remain attached to it.
          const key = `pos_parked_carts:${businessSlug}`;
          let local: ParkedCart[] = [];
          try {
            const parsed: unknown = JSON.parse(safeGetItem(key) || "[]");
            local = Array.isArray(parsed) ? parsed as ParkedCart[] : [];
          } catch { /* Leave unreadable local data untouched. */ }
          const visible = visibleParkedForBranch(local, branchId, Boolean(currentBranch?.isMain));
          const migrated: string[] = [];
          for (const item of visible) {
            if (!mounted) return;
            if (remote.some(serverCart => serverCart.id === item.id)) {
              migrated.push(item.id);
              continue;
            }
            try {
              const moved = await createPosParkedCart(businessSlug, {
                id: item.id, note: item.note, items: item.items,
              });
              if (moved) migrated.push(item.id);
            } catch {
              // Do not silently discard legacy slips; keep them on this device
              // until the server accepts them.
              break;
            }
          }
          if (migrated.length) {
            safeSetItem(key, JSON.stringify(local.filter(item => !migrated.includes(item.id))));
          }
          const latest = migrated.length ? (await listPosParkedCarts(businessSlug)) : remote;
          if (mounted) {
            const shared = (latest ?? remote).map(item => ({ ...fromApiParkedCart(item), branchId }));
            const localRemaining = visible.filter(item =>
              !migrated.includes(item.id) && !shared.some(server => server.id === item.id),
            );
            setParkedCarts([...shared, ...localRemaining.map(item => ({ ...item, version: undefined }))]);
            if (localRemaining.length) pushNotice(
              localRemaining.length + " fiche(s) locales non synchronisées : repassez-les en attente pour les partager.",
              "warning",
            );
          }
          return;
        }
      } catch (e) {
        if (mounted && isOnline) {
          pushError("Les fiches partagées ne sont pas accessibles. Vérifiez l’API avant d’enregistrer.");
          return;
        }
      }
      if (!mounted) return;
      setUseRemoteParked(false);
      const raw = safeGetItem(`pos_parked_carts:${businessSlug}`);
      if (!raw) { setParkedCarts([]); return; }
      try {
        const parsed = JSON.parse(raw);
        setParkedCarts(Array.isArray(parsed)
          ? visibleParkedForBranch(parsed as ParkedCart[], branchId, Boolean(currentBranch?.isMain))
          : []);
      } catch { setParkedCarts([]); }
    }
    void loadParkedCarts();
    return () => { mounted = false; };
  }, [businessSlug, branchId, branchLoading, currentBranch?.isMain, pushError, isOnline]);

  useEffect(() => {
    if (!businessSlug || !branchId || !useRemoteParked || !isOnline) return undefined;
    let active = true;
    const refresh = () => {
      void listPosParkedCarts(businessSlug).then(carts => {
        if (active && carts) setParkedCarts(prev => {
          const shared = carts.map(cart => ({ ...fromApiParkedCart(cart), branchId }));
          return [...shared, ...prev.filter(item => !item.version && !shared.some(server => server.id === item.id))];
        });
      }).catch(() => { /* A transient poll must not erase valid cashier data. */ });
    };
    const timer = window.setInterval(refresh, 12000);
    return () => { active = false; window.clearInterval(timer); };
  }, [businessSlug, branchId, useRemoteParked, isOnline]);

  const reloadDepositMemos = useCallback(async () => {
    if (!businessSlug || !branchId) return;
    const result = await listUnpostedDeposits(businessSlug);
    setDeposits(result.data);
    setDepositTotals(result.totals);
    setDepositMemosComplete(!result.more_records);
    setDepositReadStatus("ready");
  }, [businessSlug, branchId]);

  useEffect(() => {
    let active = true;
    setDeposits([]);
    setDepositMemosComplete(false);
    setDepositTotals({ HTG: "0.00", USD: "0.00" });
    setDepositReadStatus("unavailable");
    if (!businessSlug || !branchId || !isOnline) return undefined;
    setDepositReadStatus("loading");
    void listUnpostedDeposits(businessSlug).then(result => {
      if (active) {
        setDeposits(result.data);
        setDepositTotals(result.totals);
        setDepositMemosComplete(!result.more_records);
        setDepositReadStatus("ready");
      }
    }).catch(() => {
      // A read error must not block sales or imply that no deposits exist.
      if (active) setDepositReadStatus("unavailable");
    }).finally(() => {});
    return () => { active = false; };
  }, [businessSlug, branchId, isOnline]);

  function saveLocalParked(next: ParkedCart[]) {
    const key = `pos_parked_carts:${businessSlug}`;
    let all: ParkedCart[] = [];
    try {
      const raw = safeGetItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      all = Array.isArray(parsed) ? parsed : [];
    } catch { /* Damaged local cache must not block parking. */ }
    setParkedCarts(next);
    safeSetItem(key, JSON.stringify(
      mergeParkedForBranch(all, next, branchId ?? "", Boolean(currentBranch?.isMain)),
    ));
  }
  const getSaleUnitPrice = useCallback((product: CatalogProduct): number => {
    return convertAmount(product.price, product.priceCurrency, saleCurrency, {
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
        exchangeBuyRate: businessSettings?.exchange_buy_rate,
        exchangeSellRate: businessSettings?.exchange_sell_rate,
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
  const scanIndex = useMemo(() => buildProductScanIndex(products), [products]);
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
  const productPageSize = 10;
  const productFilterKey = JSON.stringify([query.trim().toLowerCase(), categoryFilter]);
  const productPageCount = Math.max(1, Math.ceil(visibleProducts.length / productPageSize));
  const currentProductPage = productPageSelection.key === productFilterKey
    ? Math.min(Math.max(1, productPageSelection.page), productPageCount)
    : 1;
  const paginatedProducts = useMemo(
    () => visibleProducts.slice(
      (currentProductPage - 1) * productPageSize, currentProductPage * productPageSize,
    ),
    [visibleProducts, currentProductPage],
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
  const discountValue = discountType === "fixed" ? convertAmount(safeNumber(discountValueInput), discountCurrency, saleCurrency, {
    exchangeBuyRate: businessSettings?.exchange_buy_rate, exchangeSellRate: businessSettings?.exchange_sell_rate,
    exchangeRateDirection: businessSettings?.exchange_rate_direction, exchangeRateValue: businessSettings?.exchange_rate_value,
  }) : safeNumber(discountValueInput);
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
  const valuationConfig = { exchangeRateValue: businessSettings?.exchange_sell_rate || businessSettings?.usd_to_htg_rate || 1 };
  const couponDiscountAmount = convertAmount(appliedCoupon?.discountAmount ?? 0, businessSettings?.currency || "HTG", saleCurrency, valuationConfig);
  const grandTotal = Math.max(0, subtotal - discountAmount - couponDiscountAmount) + taxTotal;
  const previewDeposit = /^(?:0|0[.,]0{1,2})$/.test(parkDepositInput.trim())
    ? "0.00" : parseDepositAmount(parkDepositInput);
  const hasExchangeConfigured = [
    businessSettings?.exchange_buy_rate,
    businessSettings?.exchange_sell_rate,
    businessSettings?.exchange_rate_value,
  ].some(value => Number(value) > 0);
  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart],
  );
  const depositByCart = useMemo(() => {
    const grouped: Record<string, { HTG: number; USD: number }> = {};
    for (const memo of deposits) {
      const amount = Number(memo.amount);
      if (!Number.isFinite(amount)) continue;
      const sum = grouped[memo.cart_reference] ?? { HTG: 0, USD: 0 };
      sum[memo.currency] = Math.round((sum[memo.currency] + amount) * 100) / 100;
      grouped[memo.cart_reference] = sum;
    }
    for (const item of parkedCarts) {
      if (item.depositTotals) grouped[item.id] = item.depositTotals;
    }
    if (activeParked?.depositTotals) grouped[activeParked.id] = activeParked.depositTotals;
    return grouped;
  }, [deposits, parkedCarts, activeParked]);
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
  const loyaltyRedeemValue = (businessSettings?.loyalty_redeem_value || 1) * getExchangeRate(businessSettings?.currency || "HTG", saleCurrency, valuationConfig);
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
  const pointsDiscountAmount = Number((redeemPoints * loyaltyRedeemValue).toFixed(2));
  const remainingAfterPoints = Math.max(0, grandTotal - pointsDiscountAmount);
  const activeDepositTotals = activeParked
    ? (depositByCart[activeParked.id] ?? { HTG: 0, USD: 0 })
    : { HTG: 0, USD: 0 };
  const activeDepositApplied = activeParked
    ? Number((
      convertPayment(activeDepositTotals.HTG, "HTG", saleCurrency, {
        exchangeRateDirection: businessSettings?.exchange_rate_direction,
        exchangeRateValue: businessSettings?.exchange_rate_value,
        exchangeBuyRate: businessSettings?.exchange_buy_rate,
        exchangeSellRate: businessSettings?.exchange_sell_rate,
      }) + convertPayment(activeDepositTotals.USD, "USD", saleCurrency, {
        exchangeRateDirection: businessSettings?.exchange_rate_direction,
        exchangeRateValue: businessSettings?.exchange_rate_value,
        exchangeBuyRate: businessSettings?.exchange_buy_rate,
        exchangeSellRate: businessSettings?.exchange_sell_rate,
      })
    ).toFixed(2))
    : 0;
  const previewDepositInSaleCurrency = previewDeposit !== null && (parkDepositCurrency === saleCurrency || hasExchangeConfigured)
    ? activeDepositApplied + convertPayment(
        Number(previewDeposit) - activeDepositTotals[parkDepositCurrency],
        parkDepositCurrency, saleCurrency, {
          exchangeRateDirection: businessSettings?.exchange_rate_direction,
          exchangeRateValue: businessSettings?.exchange_rate_value,
          exchangeBuyRate: businessSettings?.exchange_buy_rate,
          exchangeSellRate: businessSettings?.exchange_sell_rate,
        },
      )
    : null;
  const remainingAfterDeposit = Math.max(0, remainingAfterPoints - activeDepositApplied);
  const amountDueInPaymentCurrency = useMemo(
    () =>
      convertAmount(remainingAfterDeposit, saleCurrency, paymentCurrency, {
        exchangeRateDirection: businessSettings?.exchange_rate_direction,
        exchangeRateValue: businessSettings?.exchange_rate_value,
        exchangeBuyRate: businessSettings?.exchange_buy_rate,
        exchangeSellRate: businessSettings?.exchange_sell_rate,
      }),
    [businessSettings, remainingAfterDeposit, paymentCurrency, saleCurrency],
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
          price: product.price,
          qty: qtyToAdd,
          type: product.type,
          stock: product.stock,
          taxRate: product.taxRate,
          imagePath: product.imagePath,
          currency: product.priceCurrency,
        },
      ];
    });
    if (qtyAdded > 0) {
      pushNotice(
        `${product.name} ajoute au panier (x${qtyAdded}).`,
        "success",
      );
    }
  }, [pushError, pushNotice]);
  const tryAddScannedProduct = useCallback((rawCode: string): boolean => {
    const found = resolveScannedProduct(scanIndex, rawCode);
    if (!found) return false;

    addToCart(found, 1);
    setQuery("");
    window.setTimeout(() => {
      queryInputRef.current?.focus();
      queryInputRef.current?.select();
    }, 0);
    return true;
  }, [addToCart, scanIndex]);
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
        item.productId === productId ? { ...item, discountType, discountValue, discountCurrency: saleCurrency } : item,
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
  async function recordDepositForCart(
    cartReference: string, draft: { amount: string; currency: "HTG" | "USD"; requestKey?: string },
  ): Promise<boolean> {
    const amount = /^(?:0|0[.,]0{1,2})$/.test(draft.amount.trim())
      ? "0.00" : parseDepositAmount(draft.amount);
    if (amount === null) { pushError(ui.invalidAmount); return false; }
    if (!isOnline || !branchId) { pushError(ui.noNetwork); return false; }
    const requestKey = draft.requestKey || crypto.randomUUID?.();
    if (!requestKey) { pushError(ui.noNetwork); return false; }
    const found = parkedCarts.find(item => item.id === cartReference)
      ?? (activeParked?.id === cartReference ? activeParked : null);
    setDepositDrafts(previous => ({
      ...previous, [cartReference]: { ...draft, requestKey },
    }));
    setDepositSavingId(cartReference);
    try {
      if (found?.version && useRemoteParked) {
        const updated = fromApiParkedCart(await setPosParkedDeposit(businessSlug, cartReference, {
          version: found.version, amount, currency: draft.currency, request_key: requestKey,
        }));
        setParkedCarts(prev => prev.map(item => item.id === cartReference ? updated : item));
        if (activeParked?.id === cartReference) setActiveParked(updated);
      } else {
        // Existing browser-only slips keep their original unposted memo reference
        // until they can be migrated to the shared backend.
        if (Number(amount) === 0) {
          pushError("Pour corriger cet acompte, synchronisez d'abord la fiche avec le serveur.");
          return false;
        }
        await recordUnpostedDeposit(businessSlug, {
          cart_reference: cartReference,
          amount,
          currency: draft.currency,
          request_key: requestKey,
          note: found?.note ?? parkNote.trim(),
        });
      }
      try { await reloadDepositMemos(); }
      catch { pushNotice("Acompte sauvé. Actualisez la caisse pour afficher les derniers totaux.", "warning"); }
      setDepositDrafts(previous => ({
        ...previous, [cartReference]: { amount: "", currency: draft.currency },
      }));
      pushNotice(ui.recorded, "success");
      return true;
    } catch (error) {
      pushError(getErrorMessage(error));
      return false;
    } finally {
      setDepositSavingId(null);
    }
  }

  async function parkCurrentCart() {
    if (parkSaving) return;
    if (!branchId || branchLoading) { pushError("Succursale indisponible."); return; }
    if (!cart.length) { pushError("Le panier est vide."); return; }
    const hasDeposit = parkDepositInput.trim().length > 0;
    const normalizedDeposit = !hasDeposit ? null
      : /^(?:0|0[.,]0{1,2})$/.test(parkDepositInput.trim()) ? "0.00" : parseDepositAmount(parkDepositInput);
    if (hasDeposit && normalizedDeposit === null) { pushError(ui.invalidAmount); return; }
    if (hasDeposit && (!isOnline || !hasPermission(permissions, "billing.manage"))) {
      pushError(!isOnline ? ui.noNetwork : ui.noRights);
      return;
    }
    if (!isOnline && (useRemoteParked || activeParked?.version)) {
      pushError("Connexion nécessaire pour enregistrer la fiche partagée.");
      return;
    }
    setParkSaving(true);
    const parked: ParkedCart = {
      id: activeParked?.id ?? (parkCreateId.current ||= `P-${generateClientId()}`),
      branchId,
      note: parkNote.trim() || activeParked?.note || `Panier ${parkedCarts.length + 1}`,
      createdAt: activeParked?.createdAt ?? new Date().toISOString(),
      items: sourceCart,
      version: activeParked?.version,
      depositTotals: activeParked?.depositTotals,
    };
    try {
      let saved = parked;
      if (useRemoteParked) {
        if (activeParked?.version) {
          saved = fromApiParkedCart(await updatePosParkedCart(businessSlug, parked.id, {
            note: parked.note, items: parked.items, version: activeParked.version,
          }));
          setActiveParked(saved);
          if (hasDeposit && normalizedDeposit !== null) {
            const updated = await setPosParkedDeposit(businessSlug, parked.id, {
              version: saved.version!, amount: normalizedDeposit, currency: parkDepositCurrency,
              request_key: crypto.randomUUID(),
            });
            saved = fromApiParkedCart(updated);
            setActiveParked(saved);
          }
        } else {
          const created = await createPosParkedCart(businessSlug, {
            id: parked.id, note: parked.note, items: parked.items,
            depositAmount: hasDeposit ? normalizedDeposit : null,
            depositCurrency: parkDepositCurrency,
          });
          if (!created) throw new Error("Service des fiches partagées indisponible. La fiche reste dans le panier.");
          saved = fromApiParkedCart(created);
        }
        setParkedCarts(prev => [saved, ...prev.filter(item => item.id !== saved.id)]);
        try { await reloadDepositMemos(); }
        catch { pushNotice("Fiche sauvegardée, mais totaux non actualisés.", "warning"); }
      } else {
        if (activeParked) {
          saveLocalParked([saved, ...parkedCarts.filter(item => item.id !== saved.id)]);
        } else {
          saveLocalParked([saved, ...parkedCarts]);
        }
        if (hasDeposit && normalizedDeposit && Number(normalizedDeposit) > 0) {
          // Offline/old-API fallback deliberately does not promise synced deposits.
          setDepositDrafts(prev => ({
            ...prev, [saved.id]: { amount: normalizedDeposit, currency: parkDepositCurrency },
          }));
          pushNotice("Fiche locale. Acompte à enregistrer dès que le serveur sera disponible.", "warning");
        }
      }
      setCart([]);
      setActiveParked(null);
      setParkModalOpen(false);
      setParkNote("");
      setParkDepositInput("");
      setCashReceivedInput("");
      parkCreateId.current = null;
      checkoutRequestKey.current = null;
      pushNotice(ui.savedPending, "success");
    } catch (error) {
      // Keep the cart, stable reference and deposit intact on any failure.
      pushError(getErrorMessage(error));
    } finally {
      setParkSaving(false);
    }
  }

  function resumeParkedCart(parkId: string) {
    const found = parkedCarts.find(item => item.id === parkId);
    if (!found || !branchId) return;
    if (cart.length || activeParked) {
      pushError("Mettez d’abord votre panier actuel en attente ou finalisez-le.");
      return;
    }
    checkoutRequestKey.current = null;
    setCart(found.items);
    setActiveParked(found);
    setParkNote(found.note || "");
    setParkDepositInput("");
    setParkedCarts(prev => prev.filter(item => item.id !== parkId));
    if (!useRemoteParked) saveLocalParked(parkedCarts.filter(item => item.id !== parkId));
    setError("");
    pushNotice("Fiche reprise avec ses acomptes : " + found.note, "info");
  }

  async function discardParkedCart(parkId: string) {
    const found = parkedCarts.find(item => item.id === parkId);
    if (!found || depositSavingId === parkId) return;
    setDiscardingId(parkId);
    try {
      if (useRemoteParked && found.version) {
        await deletePosParkedCart(businessSlug, parkId, found.version);
      } else if (useRemoteParked) {
        throw new Error("Actualisez la fiche avant de la supprimer.");
      }
      const next = parkedCarts.filter(item => item.id !== parkId);
      if (useRemoteParked) setParkedCarts(next);
      else saveLocalParked(next);
      setConfirmDiscard(null);
      pushNotice("Fiche supprimée. Historique des acomptes conservé.", "info");
    } catch (error) {
      pushError(getErrorMessage(error));
    } finally {
      setDiscardingId(null);
    }
  }
  async function printSaleReceipt(sale: CompletedSale) {
    const browserPaper: PrintPaper = defaultPrinter?.paperWidth === "58" ? "58mm" : "80mm";
    if (!defaultPrinter || !businessSlug) {
      printReceipt({ ...sale, locale }, { paper: browserPaper, template: printStyles[browserPaper] });
      return;
    }
    // Many ESC/POS models cannot encode Chinese or Arabic characters. Use
    // browser rendering with proper fonts instead of printing corrupted text.
    if (locale === "ar" || locale === "zh") {
      printReceipt({ ...sale, locale }, { paper: browserPaper, template: printStyles[browserPaper] });
      return;
    }
    try {
      const result = await printReceiptOnPrinter(businessSlug, defaultPrinter.id, sale.saleId, locale);
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
      printReceipt({ ...sale, locale }, { paper: browserPaper, template: printStyles[browserPaper] });
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
      await syncPendingSales(businessSlug, { userId: String(user?.id ?? "") });
      const remaining = (await listPendingSales(businessSlug)).filter((sale) => String(sale.payload.cashierId) === String(user?.id));
      setPendingSalesCount(remaining.length);
      if (remaining.length === 0) {
        pushNotice("Ventes hors-ligne synchronisees.", "success");
      } else {
        pushNotice(`${remaining.length} vente(s) hors-ligne restent a synchroniser. Consultez les ventes en attente pour voir les détails.`, "warning");
      }
    } catch (error) {
      pushError(getErrorMessage(error));
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
      if (branchId && user?.id != null) {
        rememberOfflineValue(offlineScopeKey("cash-session", businessSlug, user.id, branchId), session);
      }
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
        subtotal: convertAmount(subtotal, saleCurrency, businessSettings?.currency || "HTG", valuationConfig),
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
    if (!branchId || !cashSession) { pushError("La succursale et la session de caisse doivent être chargées."); return false; }
    if (!businessSettings) { pushError("Les taux de change ne sont pas encore charges."); return false; }
    if (cart.length === 0) {
      pushError("Ajoute des produits avant de passer a la caisse.");
      return false;
    }
    if (activeParked && (!activeParked.version || !useRemoteParked || !isOnline)) {
      pushError("Connexion au serveur requise pour finaliser une fiche avec son acompte.");
      return false;
    }
    if (activeParked && activeDepositApplied > remainingAfterPoints + 0.01) {
      pushError("L’acompte dépasse le total de la vente. Corrigez l’acompte avant l’encaissement.");
      return false;
    }
    if (paymentMethod === "cash" && cashReceived < amountDueInPaymentCurrency) {
      pushError(`Montant insuffisant: manque ${formatMoney(cashMissing, paymentCurrency)}.`);
      return false;
    }
    setCheckoutLoading(true);
    setError("");
    const idempotencyKey = checkoutRequestKey.current || generateClientId();
    checkoutRequestKey.current = idempotencyKey;
    const checkoutInput: PosCheckoutInput = {
      branchId,
      parkedCartId: activeParked?.version ? activeParked.id : undefined,
      parkedCartVersion: activeParked?.version,
      cashSessionId: String(cashSession.id),
      currency: saleCurrency,
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
        businessSettings?.name ||
        backendResult?.businessName ||
        businessSettings?.legal_name ||
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
        receiptText.cashier,
      );
      const sale: CompletedSale = {
        locale,
        customerName: selectedCustomer?.name,
        loyaltyEnabled: Boolean(selectedCustomer) && (offline ? loyaltyEnabled : backendResult?.loyaltyEnabled === true),
        loyaltyPointsEarned: backendResult?.loyaltyPointsEarned,
        loyaltyPointsBalanceAfter: backendResult?.loyaltyPointsBalanceAfter ?? null,
        loyaltyPending: offline && loyaltyEnabled && Boolean(selectedCustomer),
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
        depositApplied: backendResult?.depositApplied || activeDepositApplied,
        paymentDateLabel:
          backendResult?.paymentDateLabel ||
          new Date(backendResult?.createdAt ?? new Date().toISOString()).toLocaleString("fr-FR"),
        receiptQrCodeDataUri: backendResult?.receiptQrCodeDataUri ?? null,
        cashReceived: paymentMethod === "cash" ? cashReceived : amountDueInPaymentCurrency,
        change: paymentMethod === "cash" ? cashChange : 0,
      };
      const storageKey = `pos_sales:${businessSlug}`;
      const existingRaw = safeGetItem(storageKey);
      let existing: CompletedSale[] = [];
      try {
        const parsed: unknown = existingRaw ? JSON.parse(existingRaw) : [];
        if (Array.isArray(parsed)) existing = parsed as CompletedSale[];
      } catch { /* An unreadable local receipt history must not undo a confirmed sale. */ }
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
      if (activeParked) setParkedCarts(prev => prev.filter(item => item.id !== activeParked.id));
      setActiveParked(null);
      checkoutRequestKey.current = null;
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
    let queued = false;
    try {
      // Persist before sending: closing the tab during the request must be recoverable.
      if (!activeParked) {
        await enqueuePendingSale({
          id: idempotencyKey, business: businessSlug, payload: checkoutInput, status: "pending", error: null,
          createdAt: new Date().toISOString(), totalDisplay: grandTotal, currencyDisplay: saleCurrency,
        });
        queued = true;
      }
      const backendResult = await checkoutPosSale(businessSlug, checkoutInput);
      if (!backendResult) throw new Error("Le serveur n’a pas confirmé la vente.");
      try { await removePendingSale(idempotencyKey); }
      catch { pushNotice("Vente confirmée. La référence locale sera vérifiée à la prochaine synchronisation.", "warning"); }
      finishSale(backendResult, false);
      if (activeParked) void reloadDepositMemos().catch(() => {});
      return true;
    } catch (e) {
      if (activeParked) {
        pushError("Vente non confirmée : " + getErrorMessage(e) +
          ". Vérifiez les ventes avant de réessayer ; l’acompte et la fiche sont conservés.");
        return false;
      }
      if (queued && (!(e instanceof ApiError) || e.status >= 500 || e.status === 408)) {
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
      if (queued) {
        try { await removePendingSale(idempotencyKey); }
        catch (storageError) { pushError(getErrorMessage(storageError)); return false; }
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
    <div className="space-y-4 pb-20 xl:pb-0">
      {" "}
      <section className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
        {" "}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {" "}
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <a href="#pos-cart-section" className="rounded-lg bg-indigo-50 px-3 py-2 font-bold text-indigo-800 hover:bg-indigo-100">
              {ui.cart} · {itemCount} · {formatMoney(grandTotal, saleCurrency)}
            </a>
            <a href="#pos-pending-section"
              className="inline-flex min-w-0 flex-wrap items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-50"
              title={ui.unpostedInfo}>
              <span>{ui.declared} ({ui.unposted}) :</span>
              <span className="tabular-nums">{depositReadStatus === "ready"
                ? `HTG ${depositTotals.HTG} · USD ${depositTotals.USD}`
                : "—"}</span>
            </a>
            {!isOnline ? (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                <AlertCircle className="h-3.5 w-3.5" />
                Mode hors-ligne
                {offlineCatalogAt ? ` - catalogue du ${formatCacheTimestamp(offlineCatalogAt)}` : ""}
              </p>
            ) : null}
          </div>{" "}
          <div className="flex items-center gap-2">
            {pendingSalesCount > 0 && <Link href={`/${businessSlug}/pos/pending`} className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900">Ventes hors-ligne</Link>}
            {pendingSalesCount > 0 ? (
              <button
                onClick={() => void handleManualSync()}
                disabled={syncingSales || !isOnline}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {" "}
                {syncingSales
                  ? "Synchronisation..."
                  : `Synchroniser (${pendingSalesCount})`}{" "}
              </button>
            ) : null}
            {businessSettings?.dollar_purchase_enabled && <Link href={`/${businessSlug}/pos/dollar-purchases`} className="rounded-xl border border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-700">Achat de dollars</Link>}
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
                <Printer className="h-4 w-4" /> {receiptText.print80}{" "}
              </button>
            ) : null}
            {lastSale ? (
              <button
                type="button"
                onClick={() => printReceipt({ ...lastSale, locale }, { paper: "a4", template: printStyles.a4 })}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" /> {receiptText.printA4}
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
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(460px,1.12fr)] 2xl:grid-cols-[minmax(0,1.1fr)_minmax(520px,1fr)]">
        {" "}
        <section className="min-w-0 space-y-3">
          {" "}
          <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-3">
            {" "}
            <div className="relative">
              {" "}
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />{" "}
              <input
                ref={queryInputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setProductPageSelection({ key: "", page: 1 });
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  if (tryAddScannedProduct(query)) {
                    event.preventDefault();
                  }
                }}
                placeholder="Rechercher : nom, SKU ou code-barres"
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
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setProductPageSelection({ key: "", page: 1 });
              }}
              className="w-full md:w-72 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {" "}
              <option value="all">Toutes les catégories</option>{" "}
              {categories.map((category) => (
                <option key={category} value={category}>
                  {" "}
                  {category}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </div>{" "}
          <div className="bg-white p-3 rounded-lg border border-slate-200">
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
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
                {" "}
                {paginatedProducts.map((product) => {
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
                      className={`rounded-xl border p-1.5 sm:p-2 space-y-1 ${canSell ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-80"}`}
                    >
                      {" "}
                      <div className="flex flex-col items-start justify-between gap-2">
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
                          <div className="relative flex w-full min-h-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 sm:min-h-24">
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
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
                        <div className="min-w-0 max-w-full pr-1">
                          <div className="whitespace-normal [overflow-wrap:anywhere] text-[11px] font-bold text-slate-900 sm:text-xs">
                            {formatMoney(product.price, product.priceCurrency)}
                          </div>
                          {product.priceCurrency !== saleCurrency ? (
                            <div className="whitespace-normal [overflow-wrap:anywhere] text-[10px] text-slate-500">
                              {ui.invoicePrice}: {formatMoney(getSaleUnitPrice(product), saleCurrency)}
                            </div>
                          ) : null}
                        </div>{" "}
                        <div className="ml-auto inline-flex shrink-0 items-center gap-0.5 sm:gap-1">
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
                        {product.type === "service" ? "" : `${ui.stock}: ${product.stock}`}{" "}
                      </div>{" "}
                      <button
                        onClick={() => addToCart(product, requestedQty)}
                        disabled={!canSell}
                        className="w-full rounded-lg brand-primary-btn py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {" "}
                        <Plus className="mr-1 inline-block h-3.5 w-3.5" />{ui.add}{" "}
                      </button>{" "}
                    </article>
                  );
                })}{" "}
              </div>
            )}{" "}
            {!loadingProducts && visibleProducts.length > 0 ? (
              <nav aria-label="Pagination des produits"
                className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <span className="tabular-nums">
                  {((currentProductPage - 1) * productPageSize) + 1}–
                  {Math.min(currentProductPage * productPageSize, visibleProducts.length)}
                  {" "}sur {visibleProducts.length} produits
                </span>
                <div className="flex items-center gap-2">
                  <button type="button"
                    disabled={currentProductPage <= 1}
                    onClick={() => setProductPageSelection({ key: productFilterKey, page: currentProductPage - 1 })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                    Précédent
                  </button>
                  <span className="min-w-[50px] text-center font-semibold tabular-nums">
                    {currentProductPage} / {productPageCount}
                  </span>
                  <button type="button"
                    disabled={currentProductPage >= productPageCount}
                    onClick={() => setProductPageSelection({ key: productFilterKey, page: currentProductPage + 1 })}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40">
                    Suivant
                  </button>
                </div>
              </nav>
            ) : null}
          </div>{" "}
        </section>{" "}
        <aside id="pos-cart-section" className="min-w-0 space-y-3 scroll-mt-4">
          {" "}
          <section className="overflow-hidden bg-white rounded-lg border border-slate-300">
            {" "}
            <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              {" "}
              <div className="text-base font-semibold text-slate-900">{ui.cart}</div>{" "}
              <div className="text-sm text-slate-500">
                {itemCount} article(s)
              </div>{" "}
            </div>{" "}
            <div className="p-2.5 space-y-2 min-h-[140px] max-h-[45vh] overflow-y-auto">
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
                    <div key={item.productId} className="space-y-1.5">
                      <div className="overflow-x-auto border-b border-slate-200 bg-white">
                        <div className="flex min-w-[430px] items-center gap-2 px-2 py-2">
                          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                            <Image src={imageSrc} alt={item.name} fill sizes="28px"
                              className="h-full w-full object-cover" unoptimized
                              onError={() => setBrokenImages(prev => ({ ...prev, [item.productId]: true }))} />
                          </div>
                          <div className="min-w-[70px] flex-1 truncate text-xs font-semibold text-slate-800"
                            title={item.name + " · " + item.sku}>
                            {item.name}{item.sku ? <span className="font-normal text-slate-400"> · {item.sku}</span> : null}
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-600" title="Prix unitaire">
                            {formatMoney(item.price, saleCurrency)}
                          </span>
                          <div className="inline-flex shrink-0 items-center gap-0.5" aria-label="Quantité">
                            <button type="button" onClick={() => updateQty(item.productId, item.qty - 1)}
                              aria-label={"Diminuer " + item.name}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 hover:bg-slate-50">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-bold tabular-nums">{item.qty}</span>
                            <button type="button" onClick={() => updateQty(item.productId, item.qty + 1)}
                              aria-label={"Augmenter " + item.name}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 hover:bg-slate-50">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-right text-xs font-bold tabular-nums text-slate-900"
                            title={lineDiscount > 0 ? "Prix avant remise : " + formatMoney(lineGross, saleCurrency) : "Total ligne"}>
                            {formatMoney(lineNet, saleCurrency)}
                          </span>
                          <button type="button"
                            onClick={() => setDiscountEditorProductId(discountEditorOpen ? null : item.productId)}
                            className={lineDiscount > 0 ? "shrink-0 text-indigo-700" : "shrink-0 text-slate-400 hover:text-indigo-700"}
                            aria-label={"Remise sur " + item.name} title="Remise">
                            <Tag className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => removeLine(item.productId)}
                            className="shrink-0 text-rose-600 hover:text-rose-700"
                            aria-label={"Retirer " + item.name} title="Retirer">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {discountEditorOpen ? (
                        <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2">
                          <select value={item.discountType ?? "none"}
                            onChange={event => {
                              const nextType = event.target.value === "percent" || event.target.value === "fixed"
                                ? event.target.value : null;
                              setLineDiscount(item.productId, nextType, item.discountValue ?? 0);
                            }}
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                            <option value="none">Aucune remise</option>
                            <option value="percent">%</option>
                            <option value="fixed">{saleCurrency}</option>
                          </select>
                          <input type="number" min="0" step="0.01" disabled={!item.discountType}
                            value={item.discountValue ? String(item.discountValue) : ""}
                            onChange={event => setLineDiscount(item.productId, item.discountType ?? null, safeNumber(event.target.value))}
                            placeholder="0" aria-label="Valeur de la remise"
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100" />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}{" "}
            </div>{" "}
            <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-1 text-sm tabular-nums">
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
              <div className="flex justify-between gap-2 text-2xl font-semibold tabular-nums text-slate-950 pt-2 border-t border-slate-300">
                {" "}
                <span>Total</span> <span>{formatMoney(grandTotal, saleCurrency)}</span>{" "}
              </div>{" "}
            </div>{" "}
          </section>{" "}
          <ParkedCartsPanel
            locale={locale}
            carts={parkedCarts.filter(item => item.id !== activeParked?.id)}
            preferredCurrency={saleCurrency === "USD" ? "USD" : "HTG"}
            exchange={{
              exchangeRateDirection: businessSettings?.exchange_rate_direction,
              exchangeRateValue: businessSettings?.exchange_rate_value,
              exchangeBuyRate: businessSettings?.exchange_buy_rate,
              exchangeSellRate: businessSettings?.exchange_sell_rate,
            }}
            memosComplete={depositMemosComplete}
            drafts={depositDrafts}
            onDraft={(id, value) => setDepositDrafts(prev => ({ ...prev, [id]: value }))}
            totals={depositTotals}
            perCart={depositByCart}
            memos={deposits}
            status={depositReadStatus}
            savingDepositId={depositSavingId}
            canRecord={hasPermission(permissions, "billing.manage")}
            online={isOnline}
            branchReady={Boolean(branchId)}
            onResume={id => void resumeParkedCart(id)}
            onRecord={(id, draft) => void recordDepositForCart(id, draft)}
            onRequestDelete={id => setConfirmDiscard(parkedCarts.find(park => park.id === id) ?? null)}
            confirming={confirmDiscard}
            deletingId={discardingId}
            onCancelDelete={() => setConfirmDiscard(null)}
            onConfirmDelete={id => void discardParkedCart(id)}
          />
          <section className="bg-white rounded-lg border border-slate-200 p-3 space-y-3">
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
                  value={discountType === "fixed" && discountCurrency !== saleCurrency && discountValueInput !== "" ? discountValue : discountValueInput}
                  onChange={(event) => { setDiscountValueInput(event.target.value); setDiscountCurrency(saleCurrency); }}
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
                    {appliedCoupon.code} (- {formatMoney(couponDiscountAmount, saleCurrency)})
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
                  { setPaymentCurrency(event.target.value === "USD" ? "USD" : "HTG"); setCashReceivedInput(""); }
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="HTG">HTG</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>{" "}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
              {activeParked ? (
                <div className="font-semibold text-indigo-900">
                  Fiche reprise : {activeParked.note}
                </div>
              ) : null}
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
              {activeParked ? (
                <>
                  <div className="mt-1 font-semibold">Acompte conservé :
                    {activeDepositTotals.HTG > 0 ? " " + formatMoney(activeDepositTotals.HTG, "HTG") : ""}
                    {activeDepositTotals.USD > 0 ? " · " + formatMoney(activeDepositTotals.USD, "USD") : ""}
                    {!activeDepositTotals.HTG && !activeDepositTotals.USD ? " Aucun" : ""}
                  </div>
                  <div className="text-xs text-indigo-700">Imputé une seule fois à la confirmation de cette vente.</div>
                </>
              ) : null}
              <div className="mt-1 font-bold">
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
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => void checkoutSale()}
                disabled={checkoutLoading || cart.length === 0 || cashSessionLoading || !registerOpen}
                className="w-full rounded-xl brand-primary-btn px-3 py-3 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
                {checkoutLoading ? "Traitement..." : "Passer à la caisse"}
              </button>
              <button type="button"
                onClick={() => {
                  setParkDepositInput("");
                  setParkDepositCurrency(saleCurrency === "USD" ? "USD" : "HTG");
                  setParkModalOpen(true);
                }}
                disabled={cart.length === 0 || branchLoading || !branchId || parkSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <PauseCircle className="h-4 w-4 shrink-0" />{activeParked ? "Remettre la fiche en attente" : ui.park}
              </button>
            </div>{" "}
          </section>{" "}

        </aside>{" "}
      </div>{" "}
      <a href="#pos-cart-section"
        className="fixed bottom-3 left-3 right-3 z-40 flex items-center justify-between gap-3 rounded-xl bg-indigo-950 px-4 py-3 text-sm font-bold text-white shadow-2xl xl:hidden"
        aria-label={ui.cart}>
        <span>{ui.cart} · {itemCount} {ui.items}</span>
        <span className="tabular-nums">{formatMoney(grandTotal, saleCurrency)}</span>
      </a>
      {parkModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="park-modal-title"
            onKeyDown={event => {
              if (event.key === "Escape" && !parkSaving && depositSavingId === null) setParkModalOpen(false);
            }}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="park-modal-title" className="text-lg font-extrabold text-slate-900">{ui.park}</h2>
              <button type="button" aria-label={ui.close}
                disabled={parkSaving || depositSavingId !== null}
                onClick={() => setParkModalOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block space-y-1 text-sm font-semibold text-slate-700">
              {ui.note}
              <input autoFocus type="text" value={parkNote} maxLength={190}
                onChange={event => setParkNote(event.target.value)}
                placeholder={ui.note} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
              <label className="min-w-0 space-y-1 text-sm font-semibold text-slate-700">
                {ui.downDeposit} <span className="font-normal text-slate-500">({ui.optional})</span>
                <input type="text" inputMode="decimal" value={parkDepositInput}
                  onChange={event => setParkDepositInput(event.target.value)}
                  placeholder="0.00" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                {ui.currency}
                <select value={parkDepositCurrency}
                  onChange={event => setParkDepositCurrency(event.target.value as "HTG" | "USD")}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2.5 text-sm">
                  <option value="HTG">HTG</option><option value="USD">USD</option>
                </select>
              </label>
            </div>
            {parkDepositInput.trim() && previewDeposit === null ? (
              <p role="alert" className="text-xs font-semibold text-rose-700">{ui.invalidAmount}</p>
            ) : null}
            <div className="space-y-1 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">
              <div className="flex justify-between gap-2">
                <span>{ui.subtotal}</span><strong>{formatMoney(grandTotal, saleCurrency)}</strong>
              </div>
              {activeParked ? (
                <div className="text-xs font-semibold text-indigo-800">
                  Acompte conservé : {formatMoney(activeDepositTotals.HTG, "HTG")} · {formatMoney(activeDepositTotals.USD, "USD")}
                </div>
              ) : null}
              {previewDeposit !== null ? (
                <>
                  <div className="flex justify-between gap-2">
                    <span>{ui.declaredOnSlip}</span>
                    <strong>{formatMoney(Number(previewDeposit), parkDepositCurrency)}</strong>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-indigo-200 pt-1 font-bold">
                    <span>{ui.estimatedDue}</span>
                    <span>{previewDepositInSaleCurrency == null ? "—" :
                      formatMoney(Math.max(0, grandTotal - previewDepositInSaleCurrency), saleCurrency)}</span>
                  </div>
                </>
              ) : null}
              {activeParked ? (
                <p className="text-[11px] text-indigo-700">Laissez le montant vide pour conserver l’acompte. Saisissez le nouveau total pour le modifier (0 pour annuler).</p>
              ) : null}
              <p className="text-[11px] text-indigo-700">{ui.unpostedInfo}</p>
            </div>
            {parkDepositInput.trim() && (!isOnline || !hasPermission(permissions, "billing.manage")) ? (
              <p className="text-xs font-semibold text-amber-700">{!isOnline ? ui.noNetwork : ui.noRights}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={parkSaving || depositSavingId !== null}
                onClick={() => setParkModalOpen(false)}
                className="rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
                {ui.no}
              </button>
              <button type="button" disabled={parkSaving || depositSavingId !== null || cart.length === 0
                  || Boolean(parkDepositInput.trim() && (previewDeposit === null || !isOnline || !hasPermission(permissions, "billing.manage")))}
                onClick={() => void parkCurrentCart()}
                className="rounded-xl brand-primary-btn py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {parkSaving ? ui.loading : ui.park}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
