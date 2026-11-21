"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/context/LocaleContext";
import { solutions } from "./content";

export default function SolutionsCarousel() {
  const t = useTranslations("landing");
  const { locale } = useAppLocale();
  const rtl = locale === "ar";
  const trackRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(4);
  const [firstVisible, setFirstVisible] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const lastStart = Math.max(0, solutions.length - visibleCount);
  const pageStarts = Array.from(
    { length: Math.ceil(solutions.length / visibleCount) },
    (_, index) => Math.min(index * visibleCount, lastStart),
  );
  const activePage = pageStarts.reduce(
    (closest, start, index) => Math.abs(start - firstVisible) < Math.abs(pageStarts[closest] - firstVisible) ? index : closest,
    0,
  );

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[Math.max(0, Math.min(index, lastStart))] as HTMLElement | undefined;
    if (!card) return;
    const edge = rtl ? "right" : "left";
    track.scrollTo({
      left: track.scrollLeft + card.getBoundingClientRect()[edge] - track.getBoundingClientRect()[edge],
      behavior: reducedMotion ? "instant" : "smooth",
    });
  }, [lastStart, reducedMotion, rtl]);

  const syncPosition = useCallback(() => {
    const track = trackRef.current;
    const first = track?.firstElementChild;
    if (!track || !first) return;
    const styles = window.getComputedStyle(track);
    const columns = Number(styles.getPropertyValue("--solution-columns")) || 4;
    const step = first.getBoundingClientRect().width + (parseFloat(styles.columnGap) || 0);
    setVisibleCount(columns);
    if (step > 0) setFirstVisible(Math.max(0, Math.min(Math.round(Math.abs(track.scrollLeft) / step), solutions.length - columns)));
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const resizeObserver = new ResizeObserver(syncPosition);
    resizeObserver.observe(track);
    const visibilityObserver = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    visibilityObserver.observe(track);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      setReducedMotion(motion.matches);
      if (motion.matches) setPlaying(false);
    };
    syncMotion();
    motion.addEventListener("change", syncMotion);
    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      motion.removeEventListener("change", syncMotion);
    };
  }, [syncPosition]);

  useEffect(() => {
    if (!playing || reducedMotion || hovered || focused || !inView) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) goTo(firstVisible >= lastStart ? 0 : Math.min(firstVisible + visibleCount, lastStart));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, hovered, focused, inView, firstVisible, lastStart, visibleCount, goTo]);

  function move(direction: number) {
    setPlaying(false);
    const next = (activePage + direction + pageStarts.length) % pageStarts.length;
    goTo(pageStarts[next]);
  }

  return (
    <div className="solutions-carousel" role="region" aria-roledescription={t("carousel.role")} aria-labelledby="solutions-title"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="solutions-track" id="solutions-track" ref={trackRef} tabIndex={0}
        aria-label={t("carousel.hint")}
        onScroll={syncPosition} onPointerDown={() => setPlaying(false)} onWheel={() => setPlaying(false)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault(); move((event.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1));
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault(); setPlaying(false); goTo(event.key === "Home" ? 0 : lastStart);
          }
        }}>
        {solutions.map((solution, index) => (
          <article key={solution.businessType} className="card-service" role="group"
            aria-roledescription={t("carousel.slide")} aria-label={t("carousel.slideLabel", { index: index + 1, total: solutions.length, title: t(`solutions.${solution.businessType}.title`) })}>
            <div className="service-badge" aria-hidden="true">{solution.emoji}</div>
            <h3>{t(`solutions.${solution.businessType}.title`)}</h3><p>{t(`solutions.${solution.businessType}.text`)}</p>
            <a href="#applications" className="service-link" aria-label={t("carousel.moreLabel", { title: t(`solutions.${solution.businessType}.title`) })}>{t("carousel.more")}</a>
          </article>
        ))}
      </div>
      <div className="solutions-controls">
        <p className="solutions-count" aria-live="off">{t("carousel.count", { start: firstVisible + 1, end: Math.min(firstVisible + visibleCount, solutions.length), total: solutions.length })}</p>
        <div className="solutions-navigation">
          <button type="button" className="solutions-arrow" aria-label={t("carousel.previous")} aria-controls="solutions-track" onClick={() => move(-1)}>{rtl ? "→" : "←"}</button>
          <div className="solutions-pages" aria-label={t("carousel.pages")}>
            {pageStarts.map((start, index) => (
              <button key={start} type="button" className="solutions-dot"
                aria-label={t("carousel.page", { start: start + 1, end: Math.min(start + visibleCount, solutions.length) })}
                aria-current={activePage === index ? "true" : undefined} aria-controls="solutions-track"
                onClick={() => { setPlaying(false); goTo(start); }} />
            ))}
          </div>
          <button type="button" className="solutions-arrow" aria-label={t("carousel.next")} aria-controls="solutions-track" onClick={() => move(1)}>{rtl ? "←" : "→"}</button>
        </div>
        {!reducedMotion && <button type="button" className="solutions-play" aria-controls="solutions-track"
          aria-label={t(playing ? "carousel.pauseLabel" : "carousel.resumeLabel")}
          onClick={() => setPlaying(!playing)}>{t(playing ? "carousel.pause" : "carousel.resume")}</button>}
      </div>
    </div>
  );
}
