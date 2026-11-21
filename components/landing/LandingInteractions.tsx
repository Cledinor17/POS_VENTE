"use client";

import Link from "next/link";
import { ChevronDown, Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAppLocale } from "@/context/LocaleContext";
import { isSupportedLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/locale";
import { applications } from "./content";

const sections = [
  ["#solutions", "solutions"], ["#fonctionnalites", "pos"],
  ["#applications", "applications"], ["#tarifs", "pricing"],
];

const languageLabels: Record<Locale, string> = {
  fr: "Français", en: "English", ht: "Kreyòl ayisyen",
  es: "Español", zh: "中文", ar: "العربية",
};

export function LandingAccountLinks() {
  const t = useTranslations("landing.nav");
  const { user, activeBusiness, businesses } = useAuth();
  const slug = activeBusiness?.slug || businesses[0]?.slug;
  const accountHref = user ? (slug ? `/${slug}/dashboard` : "/onboarding/business") : "/login";
  return (
    <div className="topbar-account-links">
      <Link href={accountHref} className="topbar-account-link">{t(user ? "account" : "login")}</Link>
      <Link href="/register" className="topbar-account-link topbar-register">{t("register")}</Link>
    </div>
  );
}

function LandingLanguageSwitcher() {
  const { locale, setLocale } = useAppLocale();
  const t = useTranslations("topbar.language_modal");
  return (
    <label className="landing-language-switcher" title={t("title")}>
      <Languages size={20} aria-hidden="true" />
      <span className="landing-language-code" aria-hidden="true" dir="ltr">{locale.toUpperCase()}</span>
      <ChevronDown size={14} aria-hidden="true" />
      <select
        value={locale}
        aria-label={t("title")}
        onChange={(event) => {
          const next = event.target.value;
          if (isSupportedLocale(next)) setLocale(next);
        }}
      >
        {SUPPORTED_LOCALES.map((value) => (
          <option key={value} value={value} lang={value}>{languageLabels[value]}</option>
        ))}
      </select>
    </label>
  );
}

export function LandingNavigation() {
  const t = useTranslations("landing.nav");
  const [open, setOpen] = useState(false);
  return (
    <header className="navbar">
      <div className="wrap nav-inner">
        <a className="brand" href="#accueil" aria-label={t("home")} dir="ltr">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span className="brand-name">Nova<span>Gest</span></span>
        </a>
        <nav className={`nav-links${open ? " open" : ""}`} id="navLinks" aria-label={t("label")}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              document.getElementById("menuBtn")?.focus();
            }
          }}>
          {sections.map(([href, label]) => <a key={href} href={href}>{t(label)}</a>)}
          <div className="nav-faq-tools">
            <Link href="/faq">{t("faq")}</Link>
            <LandingLanguageSwitcher />
          </div>
        </nav>
        <button type="button" className="menu-toggle" id="menuBtn"
          aria-label={t(open ? "close" : "open")}
          aria-controls="navLinks" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "×" : "☰"}</button>
      </div>
    </header>
  );
}

// Local commerce photos; source and license details are kept beside the assets.
const photos = [
  { src: "/images/landing/shop-counter.webp", position: "50% 65%" },
  { src: "/images/landing/store-payment.webp", position: "50% 60%" },
  { src: "/images/landing/checkout-customer.webp", position: "50% 60%" },
  { src: "/images/landing/retail-sale.webp", position: "55% 65%" },
];

export function HeroSlideshow() {
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!motion.matches && !document.hidden) setSlide((current) => (current + 1) % photos.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="hero-slider-bg" aria-hidden="true">
      {photos.map((photo, index) => (
        <div key={photo.src} className={`hero-slide${slide === index ? " active" : ""}`}
          style={{ backgroundImage: `url('${photo.src}')`, backgroundPosition: photo.position }} />
      ))}
    </div>
  );
}

export function Applications() {
  const t = useTranslations("landing");
  const { locale } = useAppLocale();
  const [selected, setSelected] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const app = applications[selected];
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + (locale === "ar" ? applications.length - 1 : 1)) % applications.length;
    else if (event.key === "ArrowLeft") next = (index + (locale === "ar" ? 1 : applications.length - 1)) % applications.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = applications.length - 1;
    else return;
    event.preventDefault(); setSelected(next); tabRefs.current[next]?.focus();
  }
  return (
    <>
      <div className="tabs-wrapper" role="tablist" aria-label={t("applicationsUi.tabs")}>
        {applications.map((item, index) => (
          <button key={item} ref={(element) => { tabRefs.current[index] = element; }}
            type="button" role="tab" id={`app-tab-${index}`} aria-controls="appPanel"
            aria-selected={selected === index} tabIndex={selected === index ? 0 : -1}
            className={`tab-pill${selected === index ? " active" : ""}`}
            onClick={() => setSelected(index)} onKeyDown={(event) => onKeyDown(event, index)}>{t(`applications.${item}.name`)}</button>
        ))}
      </div>
      <div className="app-showcase-box fade-up" id="appPanel" role="tabpanel" aria-labelledby={`app-tab-${selected}`} tabIndex={0}>
        <div className="app-desc">
          <div className="app-desc-subtitle">{t(`applications.${app}.sub`)}</div><h3>{t(`applications.${app}.name`)}</h3>
          <p style={{ color: "var(--text-muted)" }}>{t(`applications.${app}.desc`)}</p>
          <ul className="app-points">{(t.raw(`applications.${app}.points`) as string[]).map((point, index) => <li key={index}>{point}</li>)}</ul>
          <div><Link href="/register" className="btn btn-dark">{t("applicationsUi.try")}</Link></div>
        </div>
        <div className="app-mockup-frame"><div className="phone-wireframe" role="group" aria-label={t("applicationsUi.preview")}>
          <div className="phone-notch" />
          <h5 style={{ fontSize: "0.75rem", color: "var(--brand-dark)" }}>{t(`applications.${app}.name`)}</h5>
          <div className="phone-metric-block"><small>{t("applicationsUi.feature")}</small><b>{t(`applications.${app}.highlight`)}</b></div>
          <ul className="phone-module-links" aria-label={t("applicationsUi.screensLabel")}>
            {(t.raw(`applications.${app}.screens`) as string[]).map((screen, index) => (
              <li key={index}><span aria-hidden="true">✓</span>{screen}</li>
            ))}
          </ul>
        </div></div>
      </div>
    </>
  );
}

export function LandingReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = Array.from(root.current.querySelectorAll<HTMLElement>(".fade-up"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove("reveal-pending"); entry.target.classList.add("shown"); observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    for (const element of elements) {
      if (element.getBoundingClientRect().top >= window.innerHeight) {
        element.classList.add("reveal-pending"); observer.observe(element);
      }
    }
    return () => { observer.disconnect(); elements.forEach((element) => element.classList.remove("reveal-pending")); };
  }, []);
  return <div ref={root}>{children}</div>;
}
