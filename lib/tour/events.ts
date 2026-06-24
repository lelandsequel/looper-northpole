export type LooperTourAction =
  | { type: "fill-refuse" }
  | { type: "submit-intake" }
  | { type: "load-sample" }
  | { type: "select-first-funded" }
  | { type: "run-build"; initiativeId?: string };

export const LOOPER_TOUR_EVENT = "looper-tour-action";

export function dispatchTourAction(action: LooperTourAction): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LOOPER_TOUR_EVENT, { detail: action }));
}