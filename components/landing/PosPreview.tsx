"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { Banknote, Camera, ChevronDown, Minus, PauseCircle, Plus, Printer, Search, Tag, Trash2, UserRound } from "lucide-react";
import { DEFAULT_PRODUCT_AVATAR_PATH } from "@/lib/productImage";

// Match the public-facing layout of app/[business]/pos/page.tsx with demo data.
const products = [
  { name: "sandwich", sku: "SNK-001", price: 450, stock: 24, category: "snacks", quantity: 1 },
  { name: "juice", sku: "BOI-002", price: 250, stock: 36, category: "drinks", quantity: 1 },
  { name: "coffee", sku: "BOI-003", price: 150, stock: 48, category: "drinks", quantity: 2 },
  { name: "salad", sku: "SNK-004", price: 600, stock: 18, category: "snacks", quantity: 1 },
];
const cart = products.slice(0, 3);
const total = cart.reduce((sum, product) => sum + product.price * product.quantity, 0);
const itemCount = cart.reduce((sum, product) => sum + product.quantity, 0);

function Quantity({ value }: { value: number }) {
  return <span className="pos-preview-quantity"><span><Minus /></span><b>{value}</b><span><Plus /></span></span>;
}

export default function PosPreview() {
  const t = useTranslations("landing.preview");
  const format = useFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "HTG", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <figure className="pos-preview fade-up">
      <div className="pos-preview-screen" role="img"
        aria-label={t("description", { count: itemCount, total: money(total) })}>
        <div aria-hidden="true">
          <div className="pos-preview-header">
            <div><h3>{t("sale")}</h3><p>{t("cashier")} <strong>Marie D.</strong></p></div>
            <span className="pos-preview-print"><Printer /><span>{t("receipt")}</span></span>
          </div>

          <div className="pos-preview-body">
            <div className="pos-preview-catalog">
              <div className="pos-preview-panel pos-preview-filters">
                <div className="pos-preview-field pos-preview-search"><Search /><span>{t("search")}</span><Camera /></div>
                <div className="pos-preview-field pos-preview-category"><span>{t("categories")}</span><ChevronDown /></div>
              </div>
              <div className="pos-preview-panel pos-preview-products">
                {products.map((product) => (
                  <div className="pos-preview-product" key={product.sku}>
                    <span className="pos-preview-product-type">{t("product")}</span>
                    <strong className="pos-preview-product-name">{t(product.name)}</strong>
                    <small>{product.sku}</small>
                    <div className="pos-preview-product-image">
                      <Image src={DEFAULT_PRODUCT_AVATAR_PATH} alt="" width={160} height={80} sizes="160px" />
                    </div>
                    <strong className="pos-preview-price">{money(product.price)}</strong>
                    <Quantity value={product.quantity} />
                    <small>{t("stock", { count: product.stock, category: t(product.category) })}</small>
                    <span className="pos-preview-primary">{t("add")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pos-preview-checkout">
              <div className="pos-preview-panel pos-preview-cart">
                <div className="pos-preview-panel-title"><strong>{t("cart")}</strong><span>{t("items", { count: itemCount })}</span></div>
                <div className="pos-preview-cart-items">
                  {cart.map((product) => (
                    <div className="pos-preview-line" key={product.sku}>
                      <div className="pos-preview-line-title"><strong>{t(product.name)}</strong><span><Tag /><Trash2 /></span></div>
                      <small>{product.sku}</small>
                      <div className="pos-preview-line-bottom"><Quantity value={product.quantity} /><b>{money(product.price * product.quantity)}</b></div>
                    </div>
                  ))}
                </div>
                <div className="pos-preview-totals">
                  <div><span>{t("subtotal")}</span><span>{money(total)}</span></div>
                  <div><span>{t("taxes")}</span><span>{money(0)}</span></div>
                  <div className="pos-preview-total"><strong>{t("total")}</strong><strong>{money(total)}</strong></div>
                </div>
              </div>

              <div className="pos-preview-panel pos-preview-payment">
                <strong className="pos-preview-payment-title">{t("payment")}</strong>
                <div><span className="pos-preview-label">{t("customer")}</span><div className="pos-preview-field"><UserRound /><span>{t("walkin")}</span></div></div>
                <div className="pos-preview-payment-options">
                  <div><span className="pos-preview-label">{t("discount")}</span><div className="pos-preview-field"><span>{t("none")}</span><ChevronDown /></div></div>
                  <div><span className="pos-preview-label">{t("currency")}</span><div className="pos-preview-field"><span>HTG</span><ChevronDown /></div></div>
                </div>
                <div><span className="pos-preview-label">{t("method")}</span><div className="pos-preview-field"><Banknote /><span>{t("cash")}</span><ChevronDown /></div></div>
                <div className="pos-preview-amount"><span>{t("due")}</span><strong>{money(total)}</strong></div>
                <span className="pos-preview-primary pos-preview-pay">{t("checkout")}</span>
              </div>

              <div className="pos-preview-hold"><PauseCircle /><span>{t("hold")}</span></div>
            </div>
          </div>
        </div>
      </div>
      <figcaption>{t("caption")}</figcaption>
    </figure>
  );
}
