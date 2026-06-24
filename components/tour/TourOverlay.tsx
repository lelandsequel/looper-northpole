"use client";

import { useEffect, useState } from "react";

type Spotlight = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const PAD = 8;

export function TourOverlay({
  selector,
  title,
  body,
  step,
  total,
  onNext,
  onSkip,
}: {
  selector?: string;
  title: string;
  body: string;
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [spot, setSpot] = useState<Spotlight | null>(null);
  const [vh, setVh] = useState(800);

  useEffect(() => {
    setVh(window.innerHeight);
    function measure() {
      if (!selector) {
        setSpot(null);
        return;
      }
      const el = document.querySelector(selector);
      if (!el) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    }

    measure();
    const ro = new ResizeObserver(measure);
    if (selector) {
      const el = document.querySelector(selector);
      if (el) ro.observe(el);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const id = window.setInterval(measure, 400);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearInterval(id);
    };
  }, [selector]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSkip();
      if (e.key === "Enter" || e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onSkip]);

  const pct = Math.round(((step + 1) / total) * 100);

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* dim layer — pointer-events auto on card only */}
      <div
        className="absolute inset-0 bg-black/70 transition-opacity duration-300"
        style={{ pointerEvents: "auto" }}
        onClick={onNext}
        aria-hidden
      />

      {spot && (
        <div
          className="absolute rounded-lg ring-2 ring-accent/80 transition-all duration-300 ease-out"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        className="pointer-events-auto absolute left-1/2 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-surface/95 p-5 shadow-2xl backdrop-blur-md"
        style={{
          top: spot ? Math.min(spot.top + spot.height + 16, vh - 220) : "50%",
          transform: spot ? "translateX(-50%)" : "translate(-50%, -50%)",
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">
            Guided tour · {step + 1}/{total}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="font-mono text-xs text-muted transition hover:text-ink"
          >
            Skip
          </button>
        </div>

        <div className="mb-3 h-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-muted">Enter → next · Esc skip</span>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-accent/25 px-5 py-2 font-mono text-sm text-accent transition hover:bg-accent/35"
          >
            {step + 1 >= total ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}