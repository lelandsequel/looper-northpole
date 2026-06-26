"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { TOUR_DEFAULT_DWELL_MS, TOUR_STEPS, type TourStep } from "@/lib/tour/steps";
import { dispatchTourAction } from "@/lib/tour/events";
import { TourOverlay } from "./TourOverlay";

const STORAGE_KEY = "looper-tour-done";
const NAV_DELAY_MS = 650;
const SETTLE_DELAY_MS = 500;
const MANUAL_NEXT_DELAY_MS = 700;

type TourCtx = {
  active: boolean;
  start: () => void;
  end: () => void;
};

const TourContext = createContext<TourCtx>({
  active: false,
  start: () => {},
  end: () => {},
});

export function useTour() {
  return useContext(TourContext);
}

function waitForSelector(sel: string, timeoutMs = 12000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (document.querySelector(sel)) {
        resolve(true);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [settled, setSettled] = useState(false);
  const [watching, setWatching] = useState(false);
  const [canAdvance, setCanAdvance] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const actionGen = useRef(0);
  const nextInFlight = useRef(false);

  const step: TourStep | null = active ? (TOUR_STEPS[stepIndex] ?? null) : null;
  const stepId = step?.id ?? null;

  const end = useCallback(() => {
    actionGen.current += 1;
    setActive(false);
    setStepIndex(0);
    setSettled(false);
    setWatching(false);
    setCanAdvance(false);
    setTransitioning(false);
    nextInFlight.current = false;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    actionGen.current += 1;
    setStepIndex(0);
    setActive(true);
    setSettled(false);
    setWatching(false);
    setCanAdvance(false);
    setTransitioning(false);
    nextInFlight.current = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const first = TOUR_STEPS[0]?.path ?? "/";
    if (pathname !== first) {
      router.push(first);
    }
  }, [pathname, router]);

  const advanceStep = useCallback(() => {
    if (stepIndex + 1 >= TOUR_STEPS.length) {
      end();
      return;
    }
    actionGen.current += 1;
    setSettled(false);
    setWatching(false);
    setCanAdvance(false);
    setStepIndex((i) => i + 1);
  }, [stepIndex, end]);

  const next = useCallback(async () => {
    if (nextInFlight.current || transitioning) return;
    if (!canAdvance && !watching) return;
    nextInFlight.current = true;
    setWatching(false);
    setTransitioning(true);
    await delay(MANUAL_NEXT_DELAY_MS);
    setTransitioning(false);
    advanceStep();
    nextInFlight.current = false;
  }, [canAdvance, watching, transitioning, advanceStep]);

  // Run step setup: navigate, wait for target, optional auto-action.
  useEffect(() => {
    if (!active || !stepId) return;

    const current = TOUR_STEPS[stepIndex];
    if (!current) return;

    let cancelled = false;
    const gen = ++actionGen.current;

    (async () => {
      if (pathname !== current.path) {
        router.push(current.path);
        await delay(NAV_DELAY_MS);
        if (cancelled || gen !== actionGen.current) return;
      }

      const waitSel = current.waitForSelector ?? current.selector;
      if (waitSel) {
        await waitForSelector(waitSel, 15000);
      }
      if (cancelled || gen !== actionGen.current) return;

      await delay(SETTLE_DELAY_MS);
      if (cancelled || gen !== actionGen.current) return;

      setSettled(true);

      if (current.action) {
        setWatching(true);
        setCanAdvance(false);
        await delay(current.actionDelayMs ?? 800);
        if (cancelled || gen !== actionGen.current) return;
        dispatchTourAction(
          current.action === "run-build"
            ? { type: "run-build" }
            : { type: current.action },
        );
        if (!current.nextDelayMs) {
          const postDwell = current.dwellMs ?? TOUR_DEFAULT_DWELL_MS;
          await delay(postDwell);
          if (cancelled || gen !== actionGen.current) return;
          setWatching(false);
          setCanAdvance(true);
        }
      } else {
        setWatching(false);
        const dwell = current.dwellMs ?? TOUR_DEFAULT_DWELL_MS;
        setCanAdvance(false);
        await delay(dwell);
        if (cancelled || gen !== actionGen.current) return;
        setCanAdvance(true);
      }

      if (current.nextDelayMs) {
        await delay(current.nextDelayMs);
        if (cancelled || gen !== actionGen.current) return;
        setTransitioning(true);
        await delay(MANUAL_NEXT_DELAY_MS);
        if (cancelled || gen !== actionGen.current) return;
        setTransitioning(false);
        if (stepIndex + 1 < TOUR_STEPS.length) {
          setSettled(false);
          setWatching(false);
          setCanAdvance(false);
          setStepIndex((i) => i + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router stable; stepId tracks step
  }, [active, stepId, stepIndex, pathname]);

  return (
    <TourContext.Provider value={{ active, start, end }}>
      {children}
      {active && step && (
        <TourOverlay
          selector={settled ? step.selector : undefined}
          title={step.title}
          body={step.body}
          step={stepIndex}
          total={TOUR_STEPS.length}
          watching={watching}
          pending={!settled}
          canAdvance={watching || canAdvance}
          transitioning={transitioning}
          onNext={next}
          onSkip={end}
        />
      )}
    </TourContext.Provider>
  );
}

/** Auto-start when ?tour=1 (share link for Matt). */
export function TourAutoStart() {
  const { start, active } = useTour();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const force = params.get("tour") === "1";
    if (force && !active) {
      const t = window.setTimeout(start, 800);
      return () => window.clearTimeout(t);
    }
  }, [start, active]);

  return null;
}