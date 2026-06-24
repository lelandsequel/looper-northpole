import { NorthPoleDashboard } from "./NorthPoleDashboard";
import { getNorthPoleState } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function NorthPolePage() {
  const initial = await getNorthPoleState();
  return <NorthPoleDashboard initial={initial} />;
}