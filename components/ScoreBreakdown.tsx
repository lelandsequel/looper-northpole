interface Breakdown {
  priorityRaw?: number;
  score?: number;
  rice?: {
    reach?: number;
    reachFactor?: number;
    impact?: number;
    confidence?: number;
    effortTeamWeeks?: number;
    valueType?: string;
    valueTypeWeight?: number;
  };
  npv?: {
    total?: number;
    perYear?: number[];
  };
}

export function ScoreBreakdown({ breakdown }: { breakdown: Breakdown | null | undefined }) {
  if (!breakdown) return <p className="text-sm text-muted">No score breakdown.</p>;
  const rice = breakdown.rice ?? {};
  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="text-accent">
        priorityRaw = (reachFactor × impact × confidence) / effort × valueTypeWeight
      </div>
      <div className="grid gap-1 text-muted">
        <div>reachFactor (√reach) = {rice.reachFactor ?? "—"} (reach={rice.reach ?? "—"})</div>
        <div>impact (3yr NPV) = ${(rice.impact ?? 0).toLocaleString()}</div>
        <div>confidence = {rice.confidence ?? "—"}</div>
        <div>effort (team-weeks) = {rice.effortTeamWeeks ?? "—"}</div>
        <div>valueType = {rice.valueType ?? "—"} · weight = {rice.valueTypeWeight ?? "—"}</div>
        <div className="text-ink">
          → priorityRaw = <strong>{breakdown.priorityRaw ?? "—"}</strong> · display score ={" "}
          <strong>{breakdown.score ?? "—"}</strong>
        </div>
        {breakdown.npv?.total != null && (
          <div>NPV total (Bailey 3yr) = ${breakdown.npv.total.toLocaleString()}</div>
        )}
      </div>
    </div>
  );
}