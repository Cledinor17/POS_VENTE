"use client";

import Link from "next/link";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import type { MobileDownloadCard } from "@/lib/mobileDownloads";

// Public offers only; subscription billing and quota enforcement are separate.
// Basic provisionally replaces the supplied Starter offer; Standard is not priced yet.
const plans = [
  { id: "basic", monthlyUsd: 19, approximateHtg: 2550 },
  { id: "standard", monthlyUsd: null, approximateHtg: null },
  { id: "business", monthlyUsd: 49, approximateHtg: 6550 },
  { id: "enterprise", monthlyUsd: null, approximateHtg: null },
] as const;

export function Pricing() {
  const t = useTranslations("landing");
  const format = useFormatter();
  return <div className="plans-grid">{plans.map((plan) => (
    <div key={plan.id} data-plan={plan.id} className={`pricing-card fade-up${plan.id === "business" ? " featured" : ""}`}>
      {plan.id === "business" && <div className="badge-pop">{t("pricing.popular")}</div>}
      <h3>{t(`plans.${plan.id}.name`)}</h3><p className="plan-target">{t(`plans.${plan.id}.target`)}</p>
      <div className="pricing-cost">
        {plan.monthlyUsd === null ? t(plan.id === "enterprise" ? "pricing.quote" : "pricing.cost") : <>
          <bdi>{format.number(plan.monthlyUsd, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</bdi>{" "}
          <small>{t("pricing.perMonth")}</small>
        </>}
      </div>
      <div className="pricing-htg">{plan.approximateHtg === null ? t("pricing.custom") : t("pricing.htgMonthly", { amount: format.number(plan.approximateHtg, { maximumFractionDigits: 0 }) })}</div>
      <ul className="pricing-features">{(t.raw(`plans.${plan.id}.features`) as string[]).map((feature, index) => <li key={index}>{feature}</li>)}</ul>
      <Link href="/register" className={`btn ${plan.id === "business" ? "btn-orange" : "btn-dark"}`}>
        {t(plan.id === "enterprise" ? "pricing.study" : "pricing.select")}
      </Link>
    </div>
  ))}</div>;
}

export function MobileAccess({ downloads }: { downloads: MobileDownloadCard[] }) {
  const t = useTranslations("landing.mobile");
  return (
    <section id="mobile" aria-labelledby="mobile-title">
      <div className="wrap">
        <div className="download-container fade-up">
          <div className="mobile-copy">
            <span className="badge-pill">{t("badge")}</span>
            <h2 id="mobile-title">{t("title")}</h2>
            <p>{t("description")}</p>
            <Link href="/register" className="btn btn-dark">{t("register")}</Link>
          </div>
          <div className="qr-boxes">
            {downloads.map(({ id, href, qrSrc, isDownload }) => (
              <div className="qr-card" key={id}>
                <div className="qr-canvas-holder">
                  <Image src={qrSrc} width={115} height={115} unoptimized alt={isDownload ? t(`${id}.qrAlt`) : t("webQrAlt")} />
                </div>
                <h3>{t(`${id}.name`)}</h3>
                <p>{t(`${id}.description`)}</p>
                <a href={href}>{isDownload ? t(`${id}.download`) : t("web")}</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SignupBanner() {
  const t = useTranslations("landing.signup");
  return (
    <section className="signup-section" aria-labelledby="signup-title">
      <div className="wrap">
        <div className="cta-banner fade-up">
          <div>
            <h2 id="signup-title">{t("title")}</h2>
            <p>{t("description")}</p>
          </div>
          <Link href="/register" className="btn btn-orange">{t("action")}</Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const t = useTranslations("landing.footer");
  const nav = useTranslations("landing.nav");
  return (
    <footer>
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <a className="brand" href="#accueil" aria-label={nav("home")} dir="ltr">
              <span className="brand-mark" aria-hidden="true">N</span>
              <span className="brand-name">Nova<span>Gest</span></span>
            </a>
            <p className="footer-description">{t("description")}</p>
          </div>
          <div className="footer-col">
            <h3>{t("product")}</h3>
            <ul className="footer-links-list">
              <li><a href="#solutions">{t("solutions")}</a></li>
              <li><a href="#fonctionnalites">{t("pos")}</a></li>
              <li><a href="#tarifs">{t("pricing")}</a></li>
              <li><Link href="/faq">{t("faq")}</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h3>{t("platform")}</h3>
            <ul className="footer-links-list">
              <li><Link href="/login">{t("account")}</Link></li>
              <li><a href="#mobile">{t("mobile")}</a></li>
              <li><Link href="/register">{t("register")}</Link></li>
              <li><Link href="/forgot-password">{t("loginHelp")}</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h3>{t("contact")}</h3>
            <ul className="footer-links-list">
              <li><a href="mailto:contact@novagest.com" dir="ltr">contact@novagest.com</a></li>
              <li><Link href="/faq">{t("support")}</Link></li>
              <li>{t("location")}</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} NovaGest Technologies. {t("rights")}</span>
          <span>{t("tagline")}</span>
        </div>
      </div>
    </footer>
  );
}
