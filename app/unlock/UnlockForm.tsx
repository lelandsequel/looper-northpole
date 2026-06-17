"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/looper";
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) router.push(next);
    else setErr(true);
  }

  return (
    <div className="mx-auto max-w-sm pt-20">
      <h1 className="text-lg font-semibold">Access</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded border border-border bg-black/30 px-3 py-2 font-mono text-sm"
          placeholder="code"
        />
        {err && <p className="text-sm text-refused">Invalid code</p>}
        <button type="submit" className="w-full rounded bg-accent/20 py-2 font-mono text-sm text-accent">
          Enter
        </button>
      </form>
    </div>
  );
}