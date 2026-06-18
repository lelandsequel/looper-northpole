/** Soft demo gate — courtesy lock for sharing. Not real security. */
export const GATE_COOKIE = "looper_unlock";
export const GATE_CODE = process.env.GATE_CODE?.replace(/\D/g, "") || "333333";

export function isUnlocked(cookieValue: string | undefined): boolean {
  return cookieValue === GATE_CODE;
}

export function isValidUnlockCode(code: string | undefined): boolean {
  return code?.replace(/\D/g, "") === GATE_CODE;
}