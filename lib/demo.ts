/** Public demo deploy — skip courtesy unlock when set. */
export const DEMO_PUBLIC =
  process.env.DEMO_PUBLIC === "1" || process.env.NEXT_PUBLIC_DEMO_PUBLIC === "1";

/** Client-safe flag for UI hints (set NEXT_PUBLIC_DEMO_PUBLIC=1 on Vercel). */
export const DEMO_PUBLIC_CLIENT = process.env.NEXT_PUBLIC_DEMO_PUBLIC === "1";