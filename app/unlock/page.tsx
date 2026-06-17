import { Suspense } from "react";

import { UnlockForm } from "./UnlockForm";

export default function UnlockPage() {
  return (
    <Suspense fallback={<div className="pt-20 text-sm text-muted">Loading…</div>}>
      <UnlockForm />
    </Suspense>
  );
}