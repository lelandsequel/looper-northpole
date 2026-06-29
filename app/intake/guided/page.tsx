import { WizardIntakeClient } from "./WizardIntakeClient";

export default function GuidedIntakePage() {
  return (
    <main className="min-h-screen bg-background pb-24 text-foreground">
      <div className="container mx-auto px-4">
        <WizardIntakeClient />
      </div>
    </main>
  );
}
