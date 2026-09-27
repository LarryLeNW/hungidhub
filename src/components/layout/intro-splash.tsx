"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/Idhub-logo";
import styles from "./intro-splash.module.css";

/** Total run time — keep in sync with the animation delays in the CSS module. */
const DURATION = 2600;

/**
 * Netflix-style brand intro on every full page load, click to skip.
 * Rendered in the server HTML so the overlay covers the page from the very first
 * paint (no flash of the homepage); the CSS timeline plays without waiting for
 * hydration, and JS only unmounts the finished overlay / handles skip.
 */
export function IntroSplash() {
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setPlaying(false), DURATION);
    return () => window.clearTimeout(timer);
  }, []);

  // Scroll lock tied to `playing`: the cleanup must run when the intro ends, not
  // on unmount — this component stays mounted (returning null) for the app's life.
  useEffect(() => {
    if (!playing) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [playing]);

  if (!playing) return null;

  return (
    <div className={styles.overlay} onClick={() => setPlaying(false)} aria-hidden="true">
      <div className={styles.stage}>
        <span className={styles.glow} />
        <span className={styles.mark}>
          <LogoMark />
        </span>
        <span className={styles.word}>
          <span>AI</span>
          <strong>HUB</strong>
        </span>
        <span className={styles.tagline}>Tài khoản số giá tốt</span>
      </div>
    </div>
  );
}
