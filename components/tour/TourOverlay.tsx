"use client";

import { useEffect, useState } from "react";

type Spotlight = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const PAD = 10;
/** Outside the spotlight — light enough to read the UI underneath. */
const SCRIM = "rgba(8, 10, 18, 0.38)";
const SCRIM_WATCHING = "rgba(8, 10, 18, 0.22)";

export function TourOverlay({
  selector,
  title,
  body,
  step,
  total,
  watching = false,
  pending = false,
  canAdvance = true,
  transitioning = false,
  onNext,
  onSkip,
}: {
  selector?: string;
  title: string;
  body: string;
  step: number;
  total: number;
  /** Lighter scrim + compact bar while auto-actions run (refuse, intake, build…). */
  watching?: boolean;
  /** Step still navigating / waiting for target. */
  pending?: boolean;
  canAdvance?: boolean;
  transitioning?: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [spot, setSpot] = useState<Spotlight | null>(null);
  const [vh, setVh] = useState(800);
  const [vw, setVw] = useState(1200);

  useEffect(() => {
    setVh(window.innerHeight);
    setVw(window.innerWidth);
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
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
      if ((e.key === "Enter" || e.key === "ArrowRight") && canAdvance && !transitioning) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onSkip, canAdvance, transitioning]);

  const pct = Math.round(((step + 1) / total) * 100);
  const scrim = watching ? SCRIM_WATCHING : SCRIM;

  const cardWide = !watching;
  const cardTop = spot
    ? spot.top + spot.height + 20 > vh - 200
      ? Math.max(16, spot.top - 200)
      : Math.min(spot.top + spot.height + 20, vh - 220)
    : "50%";

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* No spotlight (welcome): light full scrim only. With spotlight: scrim is ONLY the box-shadow hole. */}
      {!spot && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: scrim, pointerEvents: "none" }}
          aria-hidden
        />
      )}

      {spot && (
        <>
          <div className="absolute inset-0" style={{ pointerEvents: "none" }} aria-hidden />
          <div
            className="absolute rounded-xl ring-2 ring-accent shadow-[0_0_0_1px_rgba(159,180,255,0.5),0_0_28px_rgba(159,180,255,0.25)] transition-all duration-300 ease-out"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              boxShadow: `0 0 0 9999px ${scrim}, 0 0 0 1px rgba(159,180,255,0.55), 0 0 32px rgba(159,180,255,0.3)`,
              pointerEvents: "none",
              background: watching ? "rgba(159,180,255,0.04)" : "transparent",
            }}
          />
        </>
      )}

      {watching ? (
        <div
          className="pointer-events-auto fixed inset-x-4 bottom-4 mx-auto flex max-w-3xl items-center gap-4 rounded-xl border border-accent/30 bg-surface/90 px-4 py-3 shadow-xl backdrop-blur-md"
          style={{ pointerEvents: "auto" }}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs uppercase tracking-wider text-accent">
              Watch · step {step + 1}/{total}
            </div>
            <div className="truncate text-sm font-medium text-ink">{title}</div>
          </div>
          <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-border sm:block">
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 font-mono text-xs text-muted transition hover:text-ink"
          >
            Skip
          </button>
        </div>
      ) : (
        <div
          className="pointer-events-auto absolute rounded-xl border border-accent/25 bg-surface/92 p-5 shadow-2xl backdrop-blur-md"
          style={{
            left: cardWide && vw >= 900 && spot ? Math.min(spot.left + spot.width + 20, vw - 440) : "50%",
            top: cardTop,
            width: cardWide ? "min(400px, calc(100vw - 2rem))" : "min(420px, calc(100vw - 2rem))",
            transform: cardWide && vw >= 900 && spot ? undefined : "translateX(-50%)",
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
            <span className="font-mono text-xs text-muted">
              {pending
                ? "Starting…"
                : transitioning
                  ? "Moving…"
                  : canAdvance
                    ? "Enter → next · Esc skip"
                    : "Take a moment…"}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={pending || !canAdvance || transitioning}
              className="rounded-lg bg-accent/25 px-5 py-2 font-mono text-sm text-accent transition hover:bg-accent/35 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {transitioning ? "…" : step + 1 >= total ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}