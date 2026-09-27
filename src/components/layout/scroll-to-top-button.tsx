"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

const SHOW_AFTER = 600;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    function syncVisibility() {
      setVisible(window.scrollY > SHOW_AFTER);
      frame = 0;
    }

    function handleScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(syncVisibility);
    }

    syncVisibility();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      aria-label="Lên đầu trang"
      title="Lên đầu trang"
      onClick={scrollToTop}
      className={`focus-ring fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-50 grid size-11 place-items-center rounded-full bg-[#16a34a] text-white shadow-[0_8px_24px_rgba(22,163,74,0.28)] transition-all duration-200 hover:bg-[#15803d] lg:bottom-44 lg:right-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp size={20} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
