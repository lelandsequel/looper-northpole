const styles: Record<string, string> = {
  FUNDED: "bg-funded/20 text-funded border-funded/40",
  BENCHED: "bg-benched/20 text-benched border-benched/40",
  HELD_DUPLICATE: "bg-refused/20 text-refused border-refused/40",
};

export function FundingPill({ funding }: { funding?: string }) {
  const key = funding ?? "BENCHED";
  return (
    <span className={`rounded border px-2 py-0.5 font-mono text-xs ${styles[key] ?? styles.BENCHED}`}>
      {key}
    </span>
  );
}