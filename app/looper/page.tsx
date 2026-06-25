import { LooperDashboard } from "./LooperDashboard";
import { getQueue } from "./actions";

export const dynamic = "force-dynamic";

export default async function LooperPage({
  searchParams,
}: {
  searchParams: { highlight?: string };
}) {
  const initial = await getQueue();
  return <LooperDashboard initial={initial} highlight={searchParams.highlight} />;
}