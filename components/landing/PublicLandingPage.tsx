"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/context/LocaleContext";
import type { MobileDownloadCard } from "@/lib/mobileDownloads";
import { LandingAccountLinks, LandingNavigation, HeroSlideshow, Applications, LandingReveal } from "./LandingInteractions";
import { LandingFooter, MobileAccess, Pricing, SignupBanner } from "./LandingSections";
import SolutionsCarousel from "./SolutionsCarousel";
import PosPreview from "./PosPreview";

export default function PublicLandingPage({ mobileDownloads }: { mobileDownloads: MobileDownloadCard[] }) {
 const t = useTranslations("landing");
 const { locale } = useAppLocale();
 return (
  <LandingReveal>
   <div className="public-landing" id="accueil" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
    <a className="landing-skip-link" href="#contenu">{t("skip")}</a>


  
  <div className="topbar">
    <div className="wrap">
      <span className="topbar-message">{t("topbar.tagline")}</span>
      <div className="topbar-actions">
        <span className="topbar-assistance">{t("topbar.support")} <Link href="/faq">{t("topbar.help")}</Link></span>
        <LandingAccountLinks />
      </div>
    </div>
  </div>

  
  <LandingNavigation />

  <main id="contenu">

  
  <section className="hero">
    
    <HeroSlideshow />
    
    
    <div className="hero-slider-overlay"></div>

    <div className="wrap hero-grid">
      <div className="hero-copy">
        <h1>{t.rich("hero.title", { em: (chunks) => <em>{chunks}</em> })}</h1>
        <p className="hero-lead">{t("hero.lead")}</p>
        
        <div className="hero-actions">
          <Link href="/register" className="btn btn-orange">{t("hero.try")}</Link>
          <a href="#solutions" className="btn btn-subtle">{t("hero.discover")}</a>
        </div>

        <div className="hero-social-proof">
          <div className="avatar-stack">
            <span>KM</span>
            <span>DH</span>
            <span>+90</span>
          </div>
          <p>{t("hero.proof")}</p>
        </div>
      </div>

      
      <div className="hero-stage fade-up">
        <div className="dashboard-window">
          <div className="dash-inner">
            <div className="dash-side">
              <div className="dash-side-tag">NOVAGEST CLOUD</div>
              <div className="dash-nav-item active">{t("dashboard.dashboard")}</div>
              <div className="dash-nav-item">{t("dashboard.pos")}</div>
              <div className="dash-nav-item">{t("dashboard.inventory")}</div>
              <div className="dash-nav-item">{t("dashboard.invoicing")}</div>
              <div className="dash-nav-item">{t("dashboard.reports")}</div>
            </div>
            
            <div className="dash-body-content">
              <div className="dash-user-bar">
                <b>{t("dashboard.workspace")}</b>
                <span style={{"color":"var(--text-muted)"}}>{t("dashboard.week")}</span>
              </div>

              <div className="kpi-cards">
                <div className="kpi-card">
                  <small>{t("dashboard.revenue")}</small>
                  <b>485 250 HTG</b>
                  <span>↗ +12.4%</span>
                </div>
                <div className="kpi-card">
                  <small>{t("dashboard.profit")}</small>
                  <b>182 800 HTG</b>
                  <span>↗ +8.1%</span>
                </div>
                <div className="kpi-card">
                  <small>{t("dashboard.transactions")}</small>
                  <b>427</b>
                  <span>{t("dashboard.today")}</span>
                </div>
              </div>

              <div className="dash-panels-split">
                <div className="chart-panel">
                  <h5>{t("dashboard.trend")}</h5>
                  <div className="mini-chart">
                    <span style={{"height":"35%"}}></span>
                    <span style={{"height":"48%"}}></span>
                    <span style={{"height":"62%"}}></span>
                    <span style={{"height":"78%"}}></span>
                    <span style={{"height":"55%"}}></span>
                    <span style={{"height":"92%"}}></span>
                    <span style={{"height":"100%"}}></span>
                  </div>
                </div>
                <div className="activity-panel">
                  <h5>{t("dashboard.sales")}</h5>
                  <ul>
                    <li><span>#1049 ({t("dashboard.store")})</span> <b>5 600 HTG</b></li>
                    <li><span>#1048 ({t("dashboard.register")})</span> <b>1 250 HTG</b></li>
                    <li><span>#1047 ({t("dashboard.online")})</span> <b>$ 85.00</b></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-badge-float">
          {t("dashboard.collected")}
          <b>+ 34 750 HTG</b>
        </div>
      </div>
    </div>
  </section>

  
  <div className="trust-strip">
    <div className="wrap trust-items">
      {(t.raw("trust") as string[]).map((text, index) => <span key={index}>{text}</span>)}
    </div>
  </div>

  
  <section id="solutions">
    <div className="wrap">
      <div className="head center fade-up">
        <span className="badge-pill">{t("nav.solutions")}</span>
        <h2 id="solutions-title">{t("solutionsHeading.title")}</h2>
        <p>{t("solutionsHeading.description")}</p>
      </div>

      <SolutionsCarousel key={locale} />
    </div>
  </section>

  
  <section className="pos-section" id="fonctionnalites">
    <div className="wrap pos-layout">
      <div className="pos-copy fade-up">
        <span className="badge-pill" style={{"background":"rgba(234, 88, 12, 0.15)","color":"#fdba74","borderColor":"rgba(234, 88, 12, 0.3)"}}>{t("nav.pos")}</span>
        <h2>{t("pos.title")}</h2>
        <p>{t("pos.description")}</p>
        
        <ul className="check-list">
          {(t.raw("pos.features") as string[]).map((text, index) => <li key={index}>{text}</li>)}
        </ul>

        <Link href="/register" className="btn btn-orange">{t("pos.demo")}</Link>
      </div>

      <PosPreview />
    </div>
  </section>

  
  <section id="applications" style={{"backgroundColor":"var(--bg-white)"}}>
    <div className="wrap">
      <div className="head center fade-up">
        <span className="badge-pill">{t("nav.applications")}</span>
        <h2>{t("applicationsHeading.title")}</h2>
        <p>{t("applicationsHeading.description")}</p>
      </div>

      <Applications />

      
    </div>
  </section>

  
  <section id="tarifs" style={{"backgroundColor":"var(--bg-gray-subtle)"}}>
    <div className="wrap">
      <div className="head center fade-up">
        <span className="badge-pill">{t("nav.pricing")}</span>
        <h2>{t("pricing.title")}</h2>
        <p>{t("pricing.description")}</p>
      </div>

      <Pricing />

      <p style={{"textAlign":"center","color":"var(--text-muted)","fontSize":"0.85rem","marginTop":"30px"}}>
        {t("pricing.note")}
      </p>
    </div>
  </section>

  <MobileAccess downloads={mobileDownloads} />
  <SignupBanner />
  </main>
  <LandingFooter />
   </div>
  </LandingReveal>
 );
}
