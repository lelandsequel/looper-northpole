import { LooperDashboard } from "./LooperDashboard";
import { getQueue } from "./actions";

export const dynamic = "force-dynamic";

export default async function LooperPage() {
  const initial = await getQueue();
  return <LooperDashboard initial={initial} />;
}