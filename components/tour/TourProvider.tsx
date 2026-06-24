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

import { TOUR_STEPS, type TourStep } from "@/lib/tour/steps";
import { dispatchTourAction } from "@/lib/tour/events";
import { TourOverlay } from "./TourOverlay";

const STORAGE_KEY = "looper-tour-done";

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
  const [ready, setReady] = useState(false);
  const [watching, setWatching] = useState(false);
  const actionGen = useRef(0);

  const step: TourStep | null = active ? (TOUR_STEPS[stepIndex] ?? null) : null;

  const end = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    setReady(false);
    setWatching(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
    setReady(false);
    setWatching(false);
    router.push(TOUR_STEPS[0]?.path ?? "/");
  }, [router]);

  const next = useCallback(() => {
    if (stepIndex + 1 >= TOUR_STEPS.length) {
      end();
      return;
    }
    setReady(false);
    setWatching(false);
    setStepIndex((i) => i + 1);
  }, [stepIndex, end]);

  // Navigate + wait for target when step changes
  useEffect(() => {
    if (!active || !step) return;

    let cancelled = false;

    (async () => {
      if (pathname !== step.path) {
        router.push(step.path);
        await delay(350);
      }

      const waitSel = step.waitForSelector ?? step.selector;
      if (waitSel) {
        await waitForSelector(waitSel, 15000);
      }
      if (cancelled) return;

      await delay(200);
      if (cancelled) return;

      const gen = ++actionGen.current;
      if (step.action) {
        setWatching(true);
        setReady(true);
        await delay(step.actionDelayMs ?? 500);
        if (cancelled || gen !== actionGen.current) return;
        dispatchTourAction(
          step.action === "run-build"
            ? { type: "run-build" }
            : { type: step.action },
        );
      } else {
        setWatching(false);
        setReady(true);
      }

      if (step.nextDelayMs) {
        await delay(step.nextDelayMs);
        if (cancelled || gen !== actionGen.current) return;
        if (stepIndex + 1 < TOUR_STEPS.length) {
          setReady(false);
          setWatching(false);
          setStepIndex((i) => i + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, step, stepIndex, pathname, router]);

  return (
    <TourContext.Provider value={{ active, start, end }}>
      {children}
      {active && ready && step && (
        <TourOverlay
          selector={step.selector}
          title={step.title}
          body={step.body}
          step={stepIndex}
          total={TOUR_STEPS.length}
          watching={watching}
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
    let done = false;
    try {
      done = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (force && !active) {
      const t = window.setTimeout(start, 500);
      return () => window.clearTimeout(t);
    }
  }, [start, active]);

  return null;
}