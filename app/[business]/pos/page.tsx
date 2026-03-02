"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Banknote,
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
  Trash2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
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
  type PosParkedCart as PosParkedCartApi,
  type PosPaymentMethodConfig,
} from "@/lib/posApi";

type CartItem = {
  productId: string;
  name: string;
  sku: string;
  price: number;
  qty: number;
  type: "product" | "service";
  stock: number;
  taxRate: number;
  imagePath: string | null;
};
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
  receiptNo: string;
  createdAt: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  cashierName: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethodId;
  cashReceived: number;
  change: number;
};
type NoticeTone = "success" | "info" | "warning" | "error";
type Notice = {
  id: number;
  tone: NoticeTone;
  message: string;
};
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Carte", icon: CreditCard },
  { id: "mobile_money", label: "Mobile", icon: Smartphone },
  { id: "bank_transfer", label: "Virement", icon: Landmark },
  { id: "voucher", label: "Bon", icon: Wallet },
];
function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}
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
    localStorage.getItem(`pos_payment_methods:${business}`),
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
      const lineTotal = item.qty * item.price;
      return ` <tr> <td>${item.name}</td> <td style="text-align:right">${item.qty} x ${formatMoney(item.price)}</td> <td style="text-align:right">${formatMoney(lineTotal)}</td> </tr> `;
    })
    .join("");
  const paymentLabel =
    DEFAULT_PAYMENT_METHODS.find((m) => m.id === sale.paymentMethod)?.label ??
    sale.paymentMethod;
  const cashBlock =
    sale.paymentMethod === "cash"
      ? ` <div class="row"><span>Recu</span><strong>${formatMoney(sale.cashReceived)}</strong></div> <div class="row"><span>Monnaie</span><strong>${formatMoney(sale.change)}</strong></div> `
      : "";
  return `
<!doctype html>
<html> <head> <meta charset="utf-8" /> <title>Ticket ${sale.receiptNo}</title> <style> @page { size: 80mm auto; margin: 4mm; } body { font-family: Arial, sans-serif; font-size: 11px; width: 72mm; margin: 0 auto; color: #111827; } .center { text-align: center; } .muted { color: #6b7280; } .sep { border-top: 1px dashed #9ca3af; margin: 8px 0; } .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; } .title { font-size: 14px; font-weight: 700; margin-bottom: 2px; } table { width: 100%; border-collapse: collapse; } td { padding: 2px 0; vertical-align: top; } .grand { font-size: 14px; font-weight: 800; } </style> </head> <body> <div class="center"> <div class="title">${sale.businessName}</div> <div class="muted">${sale.businessAddress || ""}</div> <div class="muted">${sale.businessPhone || ""} ${sale.businessEmail ? " | " + sale.businessEmail : ""}</div> </div> <div class="sep"></div> <div class="row"><span>Ticket</span><strong>${sale.receiptNo}</strong></div> <div class="row"><span>Date</span><span>${new Date(sale.createdAt).toLocaleString("fr-FR")}</span></div> <div class="row"><span>Caissier</span><span>${sale.cashierName}</span></div> <div class="row"><span>Paiement</span><span>${paymentLabel}</span></div> <div class="sep"></div> <table> ${linesHtml} </table> <div class="sep"></div> <div class="row"><span>Sous-total</span><span>${formatMoney(sale.subtotal)}</span></div> <div class="row"><span>Taxes</span><span>${formatMoney(sale.tax)}</span></div> <div class="row grand"><span>Total</span><span>${formatMoney(sale.total)}</span></div> ${cashBlock} <div class="sep"></div> <div class="center muted">Merci et a bientot.</div> </body>
</html> `;
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
  const { user, activeBusiness } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
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
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastSale, setLastSale] = useState<CompletedSale | null>(null);
  function pushNotice(message: string, tone: NoticeTone = "info") {
    setNotice({ id: Date.now(), tone, message });
  }
  function pushError(message: string) {
    setError(message);
    setNotice({ id: Date.now(), tone: "error", message });
  }
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice((prev) => (prev?.id === notice.id ? null : prev));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      if (!businessSlug) return;
      setLoadingProducts(true);
      setError("");
      try {
        const data = await getProducts(businessSlug);
        if (mounted) setProducts(data);
      } catch (e) {
        if (mounted) pushError(getErrorMessage(e));
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    }
    void loadProducts();
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
  }, [businessSlug]);
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
      const raw = localStorage.getItem(`pos_parked_carts:${businessSlug}`);
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
  }, [businessSlug]);
  function saveLocalParked(next: ParkedCart[]) {
    setParkedCarts(next);
    localStorage.setItem(
      `pos_parked_carts:${businessSlug}`,
      JSON.stringify(next),
    );
  }
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
        item.category.toLowerCase().includes(normalized);
      const matchCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      return matchQuery && matchCategory;
    });
  }, [products, query, categoryFilter]);
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
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * item.price, 0),
    [cart],
  );
  const taxTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.qty * item.price * (item.taxRate / 100),
        0,
      ),
    [cart],
  );
  const grandTotal = subtotal + taxTotal;
  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart],
  );
  useEffect(() => {
    if (!businessSlug || typeof window === "undefined") return;
    const storageKey = `pos_cart_count:${businessSlug}`;
    localStorage.setItem(storageKey, String(itemCount));
    window.dispatchEvent(
      new CustomEvent("pos-cart-count-changed", {
        detail: { business: businessSlug, count: itemCount },
      }),
    );
  }, [businessSlug, itemCount]);
  const cashReceived = safeNumber(cashReceivedInput);
  const cashDelta = cashReceived - grandTotal;
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
  function addToCart(product: CatalogProduct, requestedQty = 1) {
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
        },
      ];
    });
    if (qtyAdded > 0) {
      pushNotice(
        `${product.name} ajoute au panier (x${qtyAdded}).`,
        "success",
      );
    }
  }
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
  function clearCurrentCart() {
    setCart([]);
    setCashReceivedInput("");
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
  async function checkoutSale() {
    if (cart.length === 0) {
      pushError("Ajoute des produits avant de passer a la caisse.");
      return;
    }
    if (paymentMethod === "cash" && cashReceived < grandTotal) {
      pushError(`Montant insuffisant: manque ${formatMoney(cashMissing)}.`);
      return;
    }
    setCheckoutLoading(true);
    setError("");
    try {
      const backendResult = await checkoutPosSale(businessSlug, {
        cashierId: user?.id ?? undefined,
        subtotal,
        tax: taxTotal,
        total: grandTotal,
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? cashReceived : grandTotal,
        changeAmount: paymentMethod === "cash" ? cashChange : 0,
        items: cart.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.price,
          taxRate: item.taxRate,
          type: item.type,
          name: item.name,
          sku: item.sku,
        })),
      });
      const businessName = getStringField(
        activeBusiness,
        ["name", "legal_name"],
        businessSlug.toUpperCase(),
      );
      const businessAddress = getStringField(
        activeBusiness,
        ["address", "full_address", "location"],
        "",
      );
      const businessPhone = getStringField(
        activeBusiness,
        ["phone", "phone_number", "contact_phone"],
        "",
      );
      const businessEmail = getStringField(
        activeBusiness,
        ["email", "contact_email"],
        "",
      );
      const cashierName = getStringField(
        user,
        ["name", "full_name"],
        "Caissier",
      );
      const sale: CompletedSale = {
        receiptNo: backendResult?.receiptNo ?? `TKT-${Date.now()}`,
        createdAt: backendResult?.createdAt ?? new Date().toISOString(),
        businessName,
        businessAddress,
        businessPhone,
        businessEmail,
        cashierName,
        items: cart,
        subtotal,
        tax: taxTotal,
        total: grandTotal,
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? cashReceived : grandTotal,
        change: paymentMethod === "cash" ? cashChange : 0,
      };
      const storageKey = `pos_sales:${businessSlug}`;
      const existingRaw = localStorage.getItem(storageKey);
      const existing = existingRaw
        ? (JSON.parse(existingRaw) as CompletedSale[])
        : [];
      localStorage.setItem(storageKey, JSON.stringify([sale, ...existing]));
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
      pushNotice(`Vente terminee. Ticket ${sale.receiptNo}.`, "success");
      printReceipt(sale);
    } catch (e) {
      pushError(getErrorMessage(e));
    } finally {
      setCheckoutLoading(false);
    }
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
          </div>{" "}
          {lastSale ? (
            <button
              onClick={() => printReceipt(lastSale)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {" "}
              <Printer className="h-4 w-4" /> Reimprimer dernier ticket{" "}
            </button>
          ) : null}{" "}
        </div>{" "}
      </section>{" "}
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
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un produit (nom, SKU, categorie)"
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
                      className={`rounded-xl border p-2 sm:p-3 space-y-1.5 sm:space-y-2 ${canSell ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-80"}`}
                    >
                      {" "}
                      <div className="flex flex-col items-start justify-between gap-2">
                        <div className="w-full flex justify-end">
                        <span className="text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-slate-100 text-slate-600">
                          {" "}
                          {product.type}{" "}
                        </span>{" "}
                        </div>
                        {" "}
                        <div className="min-w-0 w-full flex flex-col gap-2">
                           <div className="min-w-0">
                            {" "}
                            <h3 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                              {product.name}
                            </h3>{" "}
                            <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                              {product.sku}
                            </p>{" "}
                          </div>
                          <div className="w-full flex items-center justify-center">
                          <div className="w-full min-h-24 sm:min-h-48 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                            <img
                              src={imageSrc}
                              alt={product.name}
                              className="h-full w-full object-cover"
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
                      <div className="flex min-w-0 items-center justify-between gap-1 sm:gap-2">
                        <div className="min-w-0 truncate pr-1 text-[11px] sm:text-sm font-bold text-slate-900">
                          {formatMoney(product.price)}
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
                      <div className="text-xs text-slate-500">
                        {" "}
                        Stock:{" "}
                        {product.type === "service" ? "N/A" : product.stock} |
                        Cat: {product.category}{" "}
                      </div>{" "}
                      <button
                        onClick={() => addToCart(product, requestedQty)}
                        disabled={!canSell}
                        className="w-full rounded-lg brand-primary-btn text-white text-xs sm:text-sm font-semibold py-1.5 sm:py-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
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

                  return (
                  <div
                    key={item.productId}
                    className="rounded-xl border border-slate-200 p-3 space-y-2"
                  >
                    {" "}
                    <div className="flex items-start justify-between gap-3">
                      {" "}
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          <img
                            src={imageSrc}
                            alt={item.name}
                            className="h-full w-full object-cover"
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
                      <button
                        onClick={() => removeLine(item.productId)}
                        className="text-rose-600 hover:text-rose-700"
                        title="Retirer"
                      >
                        {" "}
                        <Trash2 className="h-4 w-4" />{" "}
                      </button>{" "}
                    </div>{" "}
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
                      <div className="text-sm font-bold text-slate-900">
                        {formatMoney(item.qty * item.price)}
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
                <span>{formatMoney(subtotal)}</span>{" "}
              </div>{" "}
              <div className="flex justify-between text-slate-600">
                {" "}
                <span>Taxes</span> <span>{formatMoney(taxTotal)}</span>{" "}
              </div>{" "}
              <div className="flex justify-between text-lg font-bold text-slate-900 pt-1">
                {" "}
                <span>Total</span> <span>{formatMoney(grandTotal)}</span>{" "}
              </div>{" "}
            </div>{" "}
          </section>{" "}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            {" "}
            <div className="font-bold text-slate-900">Paiement</div>{" "}
            <div className="grid grid-cols-2 gap-2">
              {" "}
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const selected = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold inline-flex items-center gap-2 justify-center ${selected ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                  >
                    {" "}
                    <Icon className="h-4 w-4" /> {method.label}{" "}
                  </button>
                );
              })}{" "}
            </div>{" "}
            {paymentMethod === "cash" ? (
              <div className="space-y-2 pt-1">
                {" "}
                <label className="text-sm font-medium text-slate-700">
                  Montant recu du client
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
                      ? `Monnaie a remettre: ${formatMoney(cashChange)}`
                      : `Montant manquant: ${formatMoney(cashMissing)}`}{" "}
                  </div>
                ) : null}{" "}
              </div>
            ) : null}{" "}
            <button
              onClick={() => {
                void checkoutSale();
              }}
              disabled={checkoutLoading || cart.length === 0}
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
    </div>
  );
}
