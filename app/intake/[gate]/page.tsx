import { notFound } from "next/navigation";

import { gateById } from "@/lib/looper/gates";

import { GateIntakeClient } from "./GateIntakeClient";

export default function GateIntakePage({ params }: { params: { gate: string } }) {
  const gate = gateById(params.gate);
  if (!gate) notFound();
  return <GateIntakeClient gate={gate} />;
}