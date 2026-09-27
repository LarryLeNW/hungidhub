"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type HeroSlide = {
  href: string;
  src: string;
  alt: string;
};

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  function goTo(nextIndex: number) {
    setActiveIndex((nextIndex + slides.length) % slides.length);
  }

  return (
    <div className="focus-within:ring-2 focus-within:ring-primary group relative min-h-[291px] overflow-hidden rounded-[8px] bg-slate-900 lg:min-h-[460px]">
      <Link href={activeSlide.href} className="relative block h-full">
        <Image
          src={activeSlide.src}
          alt={activeSlide.alt}
          fill
          priority
          sizes="(min-width: 1024px) 600px, 100vw"
          className="object-cover transition duration-300 group-hover:scale-[1.015]"
        />
      </Link>
      <button
        className="absolute left-0 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-transparent text-white/35 transition hover:text-white/80"
        type="button"
        aria-label="Banner trước"
        onClick={() => goTo(activeIndex - 1)}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        className="absolute right-0 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-transparent text-white/35 transition hover:text-white/80"
        type="button"
        aria-label="Banner sau"
        onClick={() => goTo(activeIndex + 1)}
      >
        <ChevronRight size={20} />
      </button>
      <button
        className="hidden"
        type="button"
        aria-label="Banner hiện tại"
        onClick={() => goTo(activeIndex + 1)}
      />
    </div>
  );
}
