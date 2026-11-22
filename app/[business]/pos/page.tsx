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
import SensitiveActionApprovalModal, {
  type SensitiveActionApproval,
} from "@/components/SensitiveActionApprovalModal";
import { useBranch } from "@/context/BranchContext";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { getPosSettings, type BusinessSettings } from "@/lib/businessApi";
import { hasPermission } from "@/lib/businessAccess";
import { listCustomers, type CustomerItem } from "@/lib/customersApi";
import { addHotelReservationPayment, getHotelReservations, type HotelReservation } from "@/lib/hotelApi";
import { createHotelOrder } from "@/lib/hotelOrdersApi";
import { validateCoupon } from "@/lib/couponsApi";
import {
  buildProductScanIndex,
  resolveScannedProduct,
} from "@/lib/productBarcode";
import { printReceipt, type PosReceipt } from "@/lib/posReceipt";
import {
  listBusinessApprovers,
  type BusinessApproverAbility,
  type BusinessApproverItem,
} from "@/lib/businessUsersApi";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import { getExchangeRate, convertAmount, formatMoney } from "@/lib/currency";
import {
  DEFAULT_PRODUCT_AVATAR_PATH,
  resolveProductImageUrl,
} from "@/lib/productImage";
import {
  checkoutPosSale,
  createPosParkedCart,
  cancelPosParkedCart,
  completePosParkedHotelCart,
  updatePosParkedCart,
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
  note: string;
  createdAt: string;
  updatedAt?: string;
  revision?: number;
  items: CartItem[];
  customerName?: string;
  customerId?: string | number | null;
  registeredCustomer?: CustomerItem | null;
  reservationId?: number | null;
  roomLabel?: string;
  // Optional spending limit only. This field is NOT a recorded payment.
  spendingLimit?: number | null;
  spendingCurrency?: string;
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
    updatedAt: cart.updatedAt,
    revision: cart.revision,
    items: cart.items,
    customerName: cart.customerName ?? undefined,
    customerId: cart.customerId,
    reservationId: cart.reservationId,
    roomLabel: cart.roomLabel ?? undefined,
    spendingLimit: cart.spendingLimit,
    spendingCurrency: cart.spendingCurrency ?? undefined,
  };
}
export default function PosPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const { user, activeBusiness, permissions } = useAuth();
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
  const [parkedSearchInput, setParkedSearchInput] = useState("");
  const [parkedSearch, setParkedSearch] = useState("");
  const [parkedPage, setParkedPage] = useState(1);
  const [parkedTotal, setParkedTotal] = useState(0);
  const [parkedTotalOpen, setParkedTotalOpen] = useState(0);
  const [parkedLastPage, setParkedLastPage] = useState(1);
  const [parkedLoading, setParkedLoading] = useState(false);
  const [savingParked, setSavingParked] = useState(false);
  const [activeParkedId, setActiveParkedId] = useState<string | null>(null);
  const [activeParkedRevision, setActiveParkedRevision] = useState(1);
  const [parkedCheckoutUncertain, setParkedCheckoutUncertain] = useState(false);
  const pendingParkedToken = useRef<string | null>(null);
  const migratedLocalScope = useRef<Set<string>>(new Set());
  const [parkedCustomerId, setParkedCustomerId] = useState<string | null>(null);
  const [parkNote, setParkNote] = useState("");
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
  const [freeCustomerName, setFreeCustomerName] = useState("");
  const [hotelReservations, setHotelReservations] = useState<HotelReservation[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);
  const [postingRoomCharge, setPostingRoomCharge] = useState(false);
  const [recordingRoomDeposit, setRecordingRoomDeposit] = useState(false);
  const [roomDepositInput, setRoomDepositInput] = useState("");
  const [roomDepositMethod, setRoomDepositMethod] = useState<"cash" | "card" | "bank" | "mobile">("cash");
  const [spendingLimitInput, setSpendingLimitInput] = useState("");
  const [activeSpendingLimit, setActiveSpendingLimit] = useState<number | null>(null);
  const [activeSpendingCurrency, setActiveSpendingCurrency] = useState("HTG");
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
  const canChargeRoom = hasPermission(permissions, "hotel.orders.manage") && hasPermission(permissions, "reservations.read");
  const canUseRoomDeposit = canChargeRoom && hasPermission(permissions, "reservations.manage");
  const customerNameForSale = selectedCustomer?.name || freeCustomerName.trim() || customerQuery.trim();
  const selectedReservation = hotelReservations.find((item) => item.id === selectedReservationId) ?? null;
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
    if (!businessSlug || !canChargeRoom || !isOnline) {
      setHotelReservations([]);
      return;
    }
    let cancelled = false;
    void getHotelReservations(businessSlug)
      .then((rows) => {
        if (!cancelled) setHotelReservations(rows.filter((row) => row.status === "checked_in" && row.room));
      })
      .catch(() => {
        if (!cancelled) setHotelReservations([]);
      });
    return () => { cancelled = true; };
  }, [businessSlug, canChargeRoom, isOnline]);

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
    setSelectedReservationId(null);
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
    const timer = window.setTimeout(() => {
      setParkedPage(1);
      setParkedSearch(parkedSearchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [parkedSearchInput]);

  const loadParkedCarts = useCallback(async () => {
    if (!businessSlug || !branchId) return;
    setParkedLoading(true);
    try {
      // Migrate legacy local-only tickets, preserving each original copy
      // until the database confirms insertion. clientToken makes retries safe.
      const scope = `${businessSlug}:${branchId}`;
      if (!migratedLocalScope.current.has(scope)) {
        const legacyKey = `pos_parked_carts:${businessSlug}`;
        const raw = safeGetItem(legacyKey);
        let remaining: ParkedCart[] = [];
        try {
          const parsed: unknown = raw ? JSON.parse(raw) : [];
          remaining = Array.isArray(parsed) ? parsed as ParkedCart[] : [];
        } catch {
          pushError("Anciennes fiches locales illisibles : conservation sans suppression.");
        }
        for (const old of [...remaining]) {
          try {
            await createPosParkedCart(businessSlug, {
              clientToken: `legacy-${old.id}`.slice(0, 100),
              note: old.note || "Ancienne fiche",
              items: old.items,
              customerName: old.customerName || null,
              customerId: old.customerId || null,
              reservationId: old.reservationId || null,
              roomLabel: old.roomLabel || null,
              spendingLimit: old.spendingLimit ?? null,
              spendingCurrency: old.spendingCurrency || null,
            });
            remaining = remaining.filter((item) => item.id !== old.id);
            safeSetItem(legacyKey, JSON.stringify(remaining));
          } catch {
            // Keep local original and retry on next successful load.
            pushError("Une ancienne fiche reste locale : migration vers le serveur non confirmée.");
            break;
          }
        }
        if (remaining.length === 0) migratedLocalScope.current.add(scope);
      }

      const result = await listPosParkedCarts(businessSlug, {
        q: parkedSearch, page: parkedPage, perPage: 10,
      });
      setParkedCarts(result.items.map(fromApiParkedCart));
      setParkedTotal(result.total);
      setParkedTotalOpen(result.totalOpen);
      setParkedLastPage(result.lastPage);
    } catch (e) {
      // Never represent localStorage as durable multi-device storage.
      pushError(`Chargement des fiches serveur impossible : ${getErrorMessage(e)}`);
    } finally {
      setParkedLoading(false);
    }
  }, [businessSlug, branchId, parkedPage, parkedSearch, pushError]);

  useEffect(() => { void loadParkedCarts(); }, [loadParkedCarts]);

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
  const amountDueInPaymentCurrency = useMemo(
    () =>
      convertAmount(remainingAfterPoints, saleCurrency, paymentCurrency, {
        exchangeRateDirection: businessSettings?.exchange_rate_direction,
        exchangeRateValue: businessSettings?.exchange_rate_value,
        exchangeBuyRate: businessSettings?.exchange_buy_rate,
        exchangeSellRate: businessSettings?.exchange_sell_rate,
      }),
    [businessSettings, remainingAfterPoints, paymentCurrency, saleCurrency],
  );
  // A parked-tab ceiling is a spending guard, not an accounting entry.
  const spendingLimitInSaleCurrency = activeSpendingLimit === null ? null : convertAmount(
    activeSpendingLimit, activeSpendingCurrency, saleCurrency,
    {
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
      exchangeBuyRate: businessSettings?.exchange_buy_rate,
      exchangeSellRate: businessSettings?.exchange_sell_rate,
    },
  );
  const cartGrossTotal = useCallback((items: CartItem[]): number => {
    const priced = pricePosCart(items, paymentCurrency, businessSettings?.currency || "HTG", {
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
      exchangeBuyRate: businessSettings?.exchange_buy_rate,
      exchangeSellRate: businessSettings?.exchange_sell_rate,
    });
    return priced.items.reduce((sum, item) => sum + item.qty * item.price * (1 + item.taxRate / 100), 0);
  }, [businessSettings, paymentCurrency]);
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
        const next = prev.map((item) =>
          item.productId === String(product.id)
            ? { ...item, qty: item.qty + qtyToAdd }
            : item,
        );
        if (spendingLimitInSaleCurrency !== null && cartGrossTotal(next) > spendingLimitInSaleCurrency + 0.001) {
          pushError("Plafond de consommation atteint : impossible d'ajouter cet article.");
          return prev;
        }
        qtyAdded = qtyToAdd;
        return next;
      }
      if (stockLimit < qtyToAdd) {
        pushError("Stock indisponible pour ce produit.");
        return prev;
      }
      const next = [
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
      if (spendingLimitInSaleCurrency !== null && cartGrossTotal(next) > spendingLimitInSaleCurrency + 0.001) {
        pushError("Plafond de consommation atteint : impossible d'ajouter cet article.");
        return prev;
      }
      qtyAdded = qtyToAdd;
      return next;
    });
    if (qtyAdded > 0) {
      pushNotice(
        `${product.name} ajoute au panier (x${qtyAdded}).`,
        "success",
      );
    }
  }, [pushError, pushNotice, spendingLimitInSaleCurrency, cartGrossTotal]);
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
    setCart((prev) => {
      const next = prev.flatMap((item) => {
        if (item.productId !== productId) return [item];
        if (nextQty <= 0) return [];
        if (item.type === "product" && nextQty > item.stock) {
          pushError("Stock insuffisant pour ce produit.");
          return [item];
        }
        return [{ ...item, qty: nextQty }];
      });
      if (spendingLimitInSaleCurrency !== null && cartGrossTotal(next) > spendingLimitInSaleCurrency + 0.001) {
        pushError("Plafond de consommation atteint : réduire la quantité.");
        return prev;
      }
      return next;
    });
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
  async function parkCurrentCart() {
    if (!isOnline) {
      pushError("Connexion requise : impossible de garantir la sauvegarde permanente de la fiche.");
      return;
    }
    if (savingParked) return;
    const enteredLimit = spendingLimitInput.trim() === "" ? null : Number(spendingLimitInput);
    if (enteredLimit !== null && (!Number.isFinite(enteredLimit) || enteredLimit <= 0)) {
      pushError("Le plafond de consommation doit être un montant positif.");
      return;
    }
    const limit = activeSpendingLimit ?? enteredLimit;
    const limitCurrency = activeSpendingLimit !== null ? activeSpendingCurrency : saleCurrency;
    const effectiveLimit = limit === null ? null : convertAmount(limit, limitCurrency, saleCurrency, {
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
      exchangeBuyRate: businessSettings?.exchange_buy_rate,
      exchangeSellRate: businessSettings?.exchange_sell_rate,
    });
    if (effectiveLimit !== null && cartGrossTotal(sourceCart) > effectiveLimit + 0.001) {
      pushError("La fiche dépasse le plafond. Réduire les articles avant enregistrement.");
      return;
    }
    if (!activeParkedId && !pendingParkedToken.current) {
      pendingParkedToken.current = generateClientId();
    }
    const payload = {
      clientToken: activeParkedId ? undefined : pendingParkedToken.current ?? undefined,
      note: parkNote.trim() || `Fiche ${parkedTotalOpen + 1}`,
      items: sourceCart,
      customerName: customerNameForSale || null,
      customerId: selectedCustomer?.id ?? parkedCustomerId,
      reservationId: selectedReservationId,
      roomLabel: selectedReservation?.room?.room_number || null,
      spendingLimit: limit,
      spendingCurrency: limitCurrency,
    };
    setSavingParked(true);
    try {
      const saved = activeParkedId
        ? await updatePosParkedCart(businessSlug, activeParkedId, activeParkedRevision, payload)
        : await createPosParkedCart(businessSlug, payload);
      pendingParkedToken.current = null;
      clearCurrentCart();
      setParkNote("");
      setActiveParkedId(null);
      setActiveParkedRevision(1);
      setParkedCustomerId(null);
      setSpendingLimitInput("");
      setActiveSpendingLimit(null);
      setSelectedReservationId(null);
      setSelectedCustomer(null);
      setFreeCustomerName("");
      setCustomerQuery("");
      setParkedSearchInput("");
      setParkedSearch("");
      setParkedPage(1);
      await loadParkedCarts();
      pushNotice(`Fiche ${saved.note} sauvegardée sur le serveur.`, "success");
    } catch (error) {
      // No acknowledgement => preserve the basket and the idempotency token.
      pushError(`Fiche NON enregistrée sur le serveur : ${getErrorMessage(error)}. Réessayez sans vider le panier.`);
    } finally {
      setSavingParked(false);
    }
  }
  function resumeParkedCart(parkId: string) {
    const found = parkedCarts.find((item) => item.id === parkId);
    if (!found) return;
    if (cart.length > 0 || activeParkedId) {
      pushError("Enregistrez le panier en cours avant de reprendre une autre fiche.");
      return;
    }
    setActiveParkedId(found.id);
    setParkedCheckoutUncertain(false);
    setActiveParkedRevision(found.revision ?? 1);
    setCart(found.items);
    setParkNote(found.note ?? "");
    setFreeCustomerName(found.customerName ?? "");
    setCustomerQuery("");
    setSelectedCustomer(found.registeredCustomer ?? null);
    setParkedCustomerId(found.customerId == null ? null : String(found.customerId));
    setSelectedReservationId(found.reservationId ?? null);
    setActiveSpendingLimit(found.spendingLimit ?? null);
    setActiveSpendingCurrency(found.spendingCurrency || saleCurrency);
    setSpendingLimitInput(found.spendingLimit == null ? "" : String(found.spendingLimit));
    setError("");
    // The ticket MUST remain in the server database until cancel/finalize.
    pushNotice(`Fiche reprise : ${found.note}. Modifications à enregistrer avant de quitter.`, "info");
  }
  async function discardParkedCart(parkId: string) {
    const found = parkedCarts.find((item) => item.id === parkId);
    if (!found) return;
    if (!window.confirm(`Annuler définitivement la fiche « ${found.note} » ? L'historique restera archivé.`)) return;
    try {
      await cancelPosParkedCart(businessSlug, parkId);
      if (activeParkedId === parkId) {
        clearCurrentCart();
        setActiveParkedId(null);
        setActiveParkedRevision(1);
        setParkedCustomerId(null);
      }
      await loadParkedCarts();
      pushNotice(`Fiche annulée : ${found.note}.`, "info");
    } catch (e) {
      pushError(`Annulation non confirmée : ${getErrorMessage(e)}`);
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
    if (activeParkedId && (!isOnline || parkedCheckoutUncertain)) {
      pushError("Vérifiez la synchronisation et l'historique de vente de cette fiche avant toute nouvelle tentative.");
      return false;
    }
    if (!businessSettings) { pushError("Les taux de change ne sont pas encore charges."); return false; }
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
    const idempotencyKey = activeParkedId ? `parked-${activeParkedId}` : generateClientId();
    const checkoutInput: PosCheckoutInput = {
      parkedCartId: activeParkedId ?? undefined,
      parkedCartRevision: activeParkedId ? activeParkedRevision : undefined,
      branchId,
      cashSessionId: String(cashSession.id),
      currency: saleCurrency,
      cashierId: user?.id ?? undefined,
      customerId: selectedCustomer?.id ?? parkedCustomerId ?? undefined,
      note: !selectedCustomer && customerNameForSale ? `Client: ${customerNameForSale.slice(0, 190)}` : undefined,
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
        customerName: customerNameForSale || undefined,
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
      setFreeCustomerName("");
      setCustomerQuery("");
      if (!offline && activeParkedId) {
        setActiveParkedId(null);
        setActiveParkedRevision(1);
        setParkedCustomerId(null);
        setParkedCheckoutUncertain(false);
        void loadParkedCarts();
      }
      setSelectedReservationId(null);
      setActiveSpendingLimit(null);
      setSpendingLimitInput("");
      setRedeemPointsInput("");
      setAppliedCoupon(null);
      setCouponCodeInput("");
      setCouponError("");
      void printSaleReceipt(sale);
      return sale;
    }
    let queued = false;
    try {
      if (activeParkedId) {
        // Save the exact basket before atomic ticket + invoice finalization.
        const draft = await updatePosParkedCart(businessSlug, activeParkedId, activeParkedRevision, {
          note: parkNote.trim() || "Fiche en attente",
          items: sourceCart,
          customerName: customerNameForSale || null,
          customerId: selectedCustomer?.id ?? parkedCustomerId,
          reservationId: selectedReservationId,
          roomLabel: selectedReservation?.room?.room_number || null,
          spendingLimit: activeSpendingLimit,
          spendingCurrency: activeSpendingCurrency,
        });
        checkoutInput.parkedCartRevision = draft.revision;
        setActiveParkedRevision(draft.revision);
      }
      // Persist before sending: closing the tab during the request must be recoverable.
      await enqueuePendingSale({
        id: idempotencyKey, business: businessSlug, payload: checkoutInput, status: "pending", error: null,
        createdAt: new Date().toISOString(), totalDisplay: grandTotal, currencyDisplay: saleCurrency,
      });
      queued = true;
      const backendResult = await checkoutPosSale(businessSlug, checkoutInput);
      if (!backendResult) throw new Error("Le serveur n’a pas confirmé la vente.");
      try { await removePendingSale(idempotencyKey); }
      catch { pushNotice("Vente confirmée. La référence locale sera vérifiée à la prochaine synchronisation.", "warning"); }
      finishSale(backendResult, false);
      return true;
    } catch (e) {
      if (activeParkedId && queued && (!(e instanceof ApiError) || e.status >= 500 || e.status === 408)) {
        setParkedCheckoutUncertain(true);
        setPendingSalesCount((count) => count + 1);
        pushError("Confirmation incertaine : fiche toujours conservée. Consultez les ventes en attente et leur synchronisation avant de recommencer.");
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

  async function recordRoomDeposit() {
    if (!selectedReservation || !canUseRoomDeposit || !isOnline || recordingRoomDeposit) return;
    const amount = Number(roomDepositInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      pushError("Saisissez un dépôt positif à recevoir sur le folio de la chambre.");
      return;
    }
    setRecordingRoomDeposit(true);
    try {
      await addHotelReservationPayment(businessSlug, selectedReservation.id, {
        amount: Math.round(amount * 100) / 100,
        paymentCurrency: saleCurrency === "USD" ? "USD" : "HTG",
        paymentMethod: roomDepositMethod,
        notes: "Dépôt encaissé depuis la caisse POS",
      });
      setRoomDepositInput("");
      // The hotel folio can also contain accommodation charges. A room payment
      // is NOT an earmarked available budget for POS consumption; do not
      // silently advertise its amount as a spendable balance.
      pushNotice("Paiement inscrit au folio hôtel. Son solde prend aussi en compte l'hébergement : vérifiez Hôtel > Folios.", "success");
    } catch (error) {
      pushError(`Enregistrement du dépôt non confirmé : ${getErrorMessage(error)}. Vérifiez le folio avant de recommencer.`);
    } finally {
      setRecordingRoomDeposit(false);
    }
  }
  async function chargeSelectedRoom() {
    if (!canChargeRoom || !isOnline || postingRoomCharge || !selectedReservation || !selectedReservation.room) return;
    if (cart.length === 0 || grandTotal <= 0) {
      pushError("Ajoutez des articles pour porter une addition sur la chambre.");
      return;
    }
    // Existing hotel orders do not model POS taxes/discounts/loyalty or mixed
    // product currencies. Refuse instead of silently posting a wrong folio.
    const currencies = new Set(sourceCart.map((item) => (item.currency || saleCurrency).toUpperCase()));
    if (currencies.size > 1 || discountAmount > 0 || itemDiscountTotal > 0 || taxTotal > 0 ||
        couponDiscountAmount > 0 || pointsDiscountAmount > 0) {
      pushError("Pour une addition sur chambre, utilisez des articles dans une seule devise, sans taxe ni rabais. Sinon, passez par le module Commandes hôtel.");
      return;
    }
    if (spendingLimitInSaleCurrency !== null && cartGrossTotal(sourceCart) > spendingLimitInSaleCurrency + 0.001) {
      pushError("Le plafond de consommation de cette fiche est dépassé.");
      return;
    }
    setPostingRoomCharge(true);
    let createdOrderId: number | null = null;
    try {
      const order = await createHotelOrder(businessSlug, {
        roomId: selectedReservation.room_id,
        reservationId: selectedReservation.id,
        customerId: selectedReservation.customer_id,
        currency: saleCurrency === "USD" ? "USD" : "HTG",
        status: "completed",
        note: `Commande POS - ${selectedReservation.guest_name.slice(0, 100)}`,
        totalAmount: Math.round(grandTotal * 100) / 100,
        items: cart.map((item) => ({
          productId: Number(item.productId),
          quantity: item.qty,
          unitPrice: item.price,
        })),
      });
      createdOrderId = order.id;
      if (order.status !== "completed") {
        throw new Error("La commande n'a pas été confirmée.");
      }
      setProducts((prev) => prev.map((product) => {
        const line = cart.find((item) => item.productId === String(product.id));
        return !line || product.type === "service" ? product : {
          ...product, stock: Math.max(0, product.stock - line.qty),
        };
      }));
      clearCurrentCart();
      setSelectedReservationId(null);
      setFreeCustomerName("");
      setCustomerQuery("");
      setSelectedCustomer(null);
      setActiveSpendingLimit(null);
      setSpendingLimitInput("");
      pushNotice(`Addition portée sur chambre ${selectedReservation.room.room_number} (commande #${order.id}).`, "success");
    } catch (error) {
      const message = createdOrderId
        ? `Commande hôtel #${createdOrderId} créée mais confirmation non vérifiée. Contrôlez-la dans Commandes hôtel avant toute nouvelle tentative.`
        : "Commande non confirmée. Vérifiez Commandes hôtel avant de recommencer.";
      pushError(`${message} ${getErrorMessage(error)}`);
    } finally {
      setPostingRoomCharge(false);
    }
  }
  async function checkoutSale() {
    if (spendingLimitInSaleCurrency !== null && cartGrossTotal(sourceCart) > spendingLimitInSaleCurrency + 0.001) {
      pushError("Le plafond de consommation de cette fiche est dépassé.");
      return;
    }
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
            {pendingSalesCount > 0 && <Link href={`/${businessSlug}/pos/pending`} className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900">Voir les ventes en attente</Link>}
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
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
                        <div className="min-w-0 max-w-full pr-1">
                          <div className="whitespace-normal [overflow-wrap:anywhere] text-[11px] font-bold text-slate-900 sm:text-xs">
                            {formatMoney(product.price, product.priceCurrency)}
                          </div>
                          {product.priceCurrency !== saleCurrency ? (
                            <div className="whitespace-normal [overflow-wrap:anywhere] text-[10px] text-slate-500">
                              Facture: {formatMoney(getSaleUnitPrice(product), saleCurrency)}
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
              ) : selectedCustomer || freeCustomerName ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-300 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {selectedCustomer?.name || freeCustomerName}
                      {!selectedCustomer ? " (nom libre)" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setFreeCustomerName("");
                      setCustomerQuery("");
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
                              setFreeCustomerName("");
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
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setFreeCustomerName(customerQuery.trim().slice(0, 190));
                          setSelectedCustomer(null);
                          setRedeemPointsInput("");
                          setCustomerQuery("");
                          setCustomerDropdownOpen(false);
                        }}
                        className="block w-full border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        Utiliser « {customerQuery.trim()} » sans créer de fiche client
                      </button>
                    </div>
                  ) : null}
                  {customerQuery.trim() ? (
                    <p className="mt-1 text-xs text-slate-500">Sans sélection, le nom saisi sera repris sur le ticket, sans création de client.</p>
                  ) : null}
                </div>
              )}
            </div>{" "}
            {canChargeRoom ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                <label className="block text-sm font-semibold text-indigo-900">
                  Mettre l'addition sur une chambre (optionnel)
                  <select
                    value={selectedReservationId ?? ""}
                    onChange={(event) => {
                      const id = Number(event.target.value);
                      const reservation = hotelReservations.find((item) => item.id === id);
                      setSelectedReservationId(reservation?.id ?? null);
                      setRoomDepositInput("");
                      setActiveSpendingLimit(null);
                      setSpendingLimitInput("");
                      if (reservation) {
                        setSelectedCustomer(null);
                        setFreeCustomerName(reservation.guest_name);
                        setCustomerQuery("");
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"
                  >
                    <option value="">Client comptoir / table — encaissement normal</option>
                    {hotelReservations.map((reservation) => (
                      <option key={reservation.id} value={reservation.id}>
                        Chambre {reservation.room?.room_number || reservation.room_id} — {reservation.guest_name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedReservation ? (
                  <div className="space-y-2 text-xs text-indigo-900">
                    <div>Client hébergé : {selectedReservation.guest_name}. Les achats seront ajoutés à son folio sans encaissement en caisse.</div>
                    {canUseRoomDeposit ? (
                      <div className="space-y-2 rounded-lg border border-indigo-100 bg-white p-2">
                        <label className="block font-semibold">
                          Encaisser un dépôt sur le folio hôtel ({saleCurrency})
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={roomDepositInput}
                            onChange={(event) => setRoomDepositInput(event.target.value)}
                            placeholder="Montant reçu"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                          />
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={roomDepositMethod}
                            onChange={(event) => setRoomDepositMethod(event.target.value as typeof roomDepositMethod)}
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                          >
                            <option value="cash">Espèces</option>
                            <option value="card">Carte</option>
                            <option value="mobile">Mobile</option>
                            <option value="bank">Banque</option>
                          </select>
                          <button
                            type="button"
                            disabled={recordingRoomDeposit || !isOnline || !roomDepositInput}
                            onClick={() => void recordRoomDeposit()}
                            className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
                          >
                            {recordingRoomDeposit ? "En cours..." : "Enregistrer dépôt"}
                          </button>
                        </div>
                        <p className="text-slate-500">Paiement affecté au folio complet (chambre + extras). Il ne constitue pas automatiquement un crédit disponible pour les achats. Le plafond facultatif de la fiche en attente est séparé.</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
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
              disabled={checkoutLoading || cart.length === 0 || cashSessionLoading || !registerOpen || Boolean(selectedReservation)}
              className="w-full rounded-xl brand-primary-btn text-white py-3 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {" "}
              {checkoutLoading ? "Traitement..." : "Passer a la caisse"}{" "}
            </button>{" "}
            {selectedReservation ? (
              <p className="text-xs text-indigo-700">
                Une chambre est sélectionnée : utilisez « Porter à la chambre » ci-dessous.
                Pour un paiement immédiat, revenez au mode Client comptoir / table.
              </p>
            ) : null}
            {selectedReservation && canChargeRoom ? (
              <button
                type="button"
                onClick={() => void chargeSelectedRoom()}
                disabled={postingRoomCharge || checkoutLoading || !isOnline || cart.length === 0}
                className="w-full rounded-xl border border-indigo-300 bg-indigo-50 py-3 text-sm font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
              >
                {postingRoomCharge
                  ? "Ajout au folio en cours..."
                  : `Porter ${formatMoney(grandTotal, saleCurrency)} à la chambre ${selectedReservation.room?.room_number || ""}`}
              </button>
            ) : null}
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
            <label className="block text-xs font-semibold text-slate-700">
              Plafond de consommation facultatif ({activeSpendingLimit !== null ? activeSpendingCurrency : saleCurrency})
              <input
                type="number"
                min="0"
                step="0.01"
                value={spendingLimitInput}
                disabled={activeSpendingLimit !== null}
                onChange={(event) => setSpendingLimitInput(event.target.value)}
                placeholder="Sans limite par défaut"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <span className="mt-1 block font-normal text-amber-700">
                Limite de dépense uniquement : ne constitue pas un dépôt encaissé. Pour une chambre, utilisez l'encaissement du folio ci-dessus.
              </span>
            </label>
            {activeSpendingLimit !== null ? (
              <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                Plafond : {formatMoney(spendingLimitInSaleCurrency ?? 0, saleCurrency)}.
                Reste estimé : {formatMoney(Math.max(0, (spendingLimitInSaleCurrency ?? 0) - cartGrossTotal(sourceCart)), saleCurrency)}.
                Les ajouts au-delà sont bloqués.
              </div>
            ) : null}
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
                      {parked.customerName ? `Client : ${parked.customerName} · ` : ""}
                      {parked.reservationId ? `Séjour #${parked.reservationId} · ` : ""}
                      {parked.spendingLimit != null ? `Plafond : ${formatMoney(parked.spendingLimit, parked.spendingCurrency || saleCurrency)} · ` : ""}
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
