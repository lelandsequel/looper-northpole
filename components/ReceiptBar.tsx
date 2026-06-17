export function ReceiptBar({
  label,
  sha,
  seq,
}: {
  label: string;
  sha: string | null | undefined;
  seq?: number | null;
}) {
  if (!sha) return null;
  const short = sha.length > 16 ? `${sha.slice(0, 8)}…${sha.slice(-6)}` : sha;
  return (
    <div className="font-mono text-xs text-muted">
      {label}
      {seq != null ? ` · seq ${seq}` : ""} · <span className="text-accent">{short}</span>
    </div>
  );
}