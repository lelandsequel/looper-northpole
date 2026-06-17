const RAVEN_BASE = process.env.RAVEN_URL ?? "http://localhost:4780";

export async function ravenChat(message: string, context?: Record<string, unknown>) {
  try {
    const res = await fetch(`${RAVEN_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false as const, error: `RAVEN ${res.status}` };
    const data = (await res.json()) as { reply?: string };
    return { ok: true as const, reply: data.reply ?? "" };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "RAVEN unavailable" };
  }
}