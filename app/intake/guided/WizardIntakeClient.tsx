"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";

import { submitGateIntakeViaApi } from "@/lib/looper/gate-client";
import { VALUE_TYPES } from "@/lib/looper/intake-form";

import { LOOPER_TOUR_EVENT, type LooperTourAction } from "@/lib/tour/events";

// We use the "general" gate as our baseline schema target
const GATE_ID = "general";

export function WizardIntakeClient() {
  const router = useRouter();
  
  // Wizard State
  const [step, setStep] = useState(1);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string[] | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [businessProblem, setBusinessProblem] = useState("");
  const [valueType, setValueType] = useState<string>("");
  const [mandate, setMandate] = useState(false);
  
  const [reachValue, setReachValue] = useState("1000");
  const [reachUnit, setReachUnit] = useState("users");
  const [effortTeamWeeks, setEffortTeamWeeks] = useState("6");
  
  const [revenueImpact, setRevenueImpact] = useState("");
  const [revenueSource, setRevenueSource] = useState("");
  const [costSaveAnnual, setCostSaveAnnual] = useState("");
  const [costSaveSource, setCostSaveSource] = useState("");

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  // Tour integration
  useEffect(() => {
    function handleTourAction(e: Event) {
      const action = (e as CustomEvent<LooperTourAction>).detail;
      if (action.type === "wizard-fill") {
        const titleInput = document.getElementById("wizard-title") as HTMLInputElement;
        const summaryInput = document.getElementById("wizard-summary") as HTMLTextAreaElement;
        
        if (titleInput && summaryInput) {
          setTitle("Automated Vault Secrets Rotation");
          setSummary("Replaces manual secrets rotation with an automated pipeline to prevent outages from expired certs.");
          
          setTimeout(() => {
            document.getElementById("wizard-btn-next-1")?.click();
          }, 1000);
        }
      }
      if (action.type === "wizard-next") {
        if (step === 2) {
          setValueType("Risk-Compliance");
          setMandate(true);
          setTimeout(() => document.getElementById("wizard-btn-next-2")?.click(), 1000);
        } else if (step === 3) {
          setReachValue("12");
          setReachUnit("teams");
          setEffortTeamWeeks("12");
          setTimeout(() => document.getElementById("wizard-btn-next-3")?.click(), 1000);
        }
      }
      if (action.type === "wizard-submit") {
        setCostSaveAnnual("250000");
        setTimeout(() => {
          setCostSaveSource("OpEx analysis Q3 / Jira SEC-8812");
          setTimeout(() => document.getElementById("wizard-submit-btn")?.click(), 1000);
        }, 1500);
      }
    }
    window.addEventListener(LOOPER_TOUR_EVENT, handleTourAction);
    return () => window.removeEventListener(LOOPER_TOUR_EVENT, handleTourAction);
  }, [step]);

  // Validation Logic
  const canProceedToValue = title.trim().length > 0 && summary.trim().length > 0;
  const canProceedToMath = valueType.length > 0;
  const canProceedToReceipts = reachValue.trim().length > 0 && effortTeamWeeks.trim().length > 0;
  
  // The crucial "Prove It" enforcement logic
  const hasRevenueClaim = Number(revenueImpact) > 0;
  const hasCostSaveClaim = Number(costSaveAnnual) > 0;
  const isRevenueSourced = hasRevenueClaim ? revenueSource.trim().length > 0 : true;
  const isCostSaveSourced = hasCostSaveClaim ? costSaveSource.trim().length > 0 : true;
  const canSubmit = isRevenueSourced && isCostSaveSourced;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    
    setError(null);
    setRefusal(null);
    
    // Map wizard state to the flat Record<string,string> the API expects
    const payload: Record<string, string> = {
      title,
      summary,
      businessProblem,
      valueType,
      reachValue,
      reachUnit,
      effortTeamWeeks,
      revenueImpact,
      revenueSource,
      costSaveAnnual,
      costSaveSource,
    };
    
    if (mandate) {
      payload.mandateCitation = "Selected 'Regulatory Mandate' in wizard intake.";
    }

    start(async () => {
      try {
        const result = await submitGateIntakeViaApi(GATE_ID, payload);
        router.push(`/looper?highlight=${result.initiativeId}`);
      } catch (err) {
        const e = err as Error & { cadmusErrors?: string[] };
        if (e.cadmusErrors?.length) setRefusal(e.cadmusErrors);
        else setError(e.message ?? "Submit failed");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pt-8">
      <div>
        <Link href="/" className="font-mono text-xs text-muted hover:text-accent">
          ← Back to Front Door
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Guided Intake</h1>
        <p className="mt-2 font-mono text-xs text-muted">
          CADMUS-Enforced · Step {step} of 4
        </p>
      </div>

      <div className="mb-8 flex space-x-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full ${step >= i ? "bg-accent" : "bg-border"}`}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-8 shadow-sm">
        
        {/* STEP 1: THE IDEA */}
        {step === 1 && (
          <div data-tour="wizard-step-1" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-medium">What is the problem we are solving?</h2>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Initiative Title <span className="text-accent">*</span></label>
              <input
                id="wizard-title"
                autoFocus
                className="w-full rounded border border-border bg-background p-3 text-sm focus:border-accent focus:outline-none"
                placeholder="e.g. Borrower Payment Self-Service"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Summary / Desired Outcome <span className="text-accent">*</span></label>
              <textarea
                id="wizard-summary"
                className="h-24 w-full rounded border border-border bg-background p-3 text-sm focus:border-accent focus:outline-none"
                placeholder="What exactly will this accomplish?"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Current Business Problem (Optional)</label>
              <textarea
                className="h-24 w-full rounded border border-border bg-background p-3 text-sm focus:border-accent focus:outline-none"
                placeholder="Why is this painful today?"
                value={businessProblem}
                onChange={(e) => setBusinessProblem(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                id="wizard-btn-next-1"
                type="button"
                onClick={handleNext}
                disabled={!canProceedToValue}
                className="rounded bg-accent px-6 py-2.5 font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: THE VALUE */}
        {step === 2 && (
          <div data-tour="wizard-step-2" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-medium">How does this create value?</h2>
            
            <div className="space-y-3 pt-2">
              <label className="text-sm font-medium text-muted">Select Primary Value Driver <span className="text-accent">*</span></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {VALUE_TYPES.map((vt) => (
                  <button
                    key={vt}
                    id={`wizard-vt-${vt.replace(/[^a-zA-Z]/g, "")}`}
                    type="button"
                    onClick={() => setValueType(vt)}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      valueType === vt 
                        ? "border-accent bg-accent/10" 
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <div className="font-medium">{vt}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6">
              <label className="flex items-center space-x-3 rounded-lg border border-border p-4 hover:bg-surface-hover cursor-pointer">
                <input
                  id="wizard-mandate"
                  type="checkbox"
                  className="h-5 w-5 rounded border-border text-accent focus:ring-accent"
                  checked={mandate}
                  onChange={(e) => setMandate(e.target.checked)}
                />
                <div>
                  <div className="font-medium">Regulatory / Must-Do Mandate</div>
                  <div className="text-xs text-muted">Auto-pins to NOW in the portfolio.</div>
                </div>
              </label>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={handleBack}
                className="rounded px-4 py-2.5 font-medium text-muted hover:text-foreground"
              >
                ← Back
              </button>
              <button
                id="wizard-btn-next-2"
                type="button"
                onClick={handleNext}
                disabled={!canProceedToMath}
                className="rounded bg-accent px-6 py-2.5 font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: THE MATH */}
        {step === 3 && (
          <div data-tour="wizard-step-3" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-medium">Scale & Effort</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reach Value / Year <span className="text-accent">*</span></label>
                <input
                  id="wizard-reach"
                  type="number"
                  className="w-full rounded border border-border bg-background p-3 text-sm focus:border-accent focus:outline-none"
                  value={reachValue}
                  onChange={(e) => setReachValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reach Unit</label>
                <input
                  id="wizard-reach-unit"
                  className="w-full rounded border border-border bg-background p-3 text-sm focus:border-accent focus:outline-none"
                  placeholder="e.g. users, loans, clicks"
                  value={reachUnit}
                  onChange={(e) => setReachUnit(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Effort (Team-Weeks) <span className="text-accent">*</span></label>
              <p className="text-xs text-muted">1 team-week = 1 squad working for 1 week.</p>
              <input
                id="wizard-effort"
                type="number"
                className="w-full rounded border border-border bg-background p-3 text-sm focus:border-accent focus:outline-none"
                value={effortTeamWeeks}
                onChange={(e) => setEffortTeamWeeks(e.target.value)}
              />
            </div>

            <div className="flex justify-between pt-8">
              <button
                type="button"
                onClick={handleBack}
                className="rounded px-4 py-2.5 font-medium text-muted hover:text-foreground"
              >
                ← Back
              </button>
              <button
                id="wizard-btn-next-3"
                type="button"
                onClick={handleNext}
                disabled={!canProceedToReceipts}
                className="rounded bg-accent px-6 py-2.5 font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: THE RECEIPTS */}
        {step === 4 && (
          <div data-tour="wizard-step-4" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-medium">Financial Impact & Receipts</h2>
            <p className="text-sm text-muted">
              Make a claim, owe its source. The CADMUS gate will refuse submissions missing evidence for financial claims.
            </p>
            
            <div className="rounded-lg border border-border p-5 space-y-4 bg-background">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Revenue ($ Gross / 3-Yrs)</label>
                <input
                  type="number"
                  className="w-full rounded border border-border bg-surface p-3 text-sm focus:border-accent focus:outline-none"
                  placeholder="e.g. 5000000"
                  value={revenueImpact}
                  onChange={(e) => setRevenueImpact(e.target.value)}
                />
              </div>
              
              {hasRevenueClaim && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 border-l-2 border-accent pl-4">
                  <label className="text-sm font-medium text-accent">Revenue Source / Evidence <span className="text-accent">*</span></label>
                  <input
                    className={`w-full rounded border p-3 text-sm focus:outline-none ${!isRevenueSourced ? "border-refused focus:border-refused" : "border-border focus:border-accent"}`}
                    placeholder="Link to memo, spreadsheet, or analysis..."
                    value={revenueSource}
                    onChange={(e) => setRevenueSource(e.target.value)}
                  />
                  {!isRevenueSourced && <p className="text-xs text-refused">Source is required for revenue claims.</p>}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-5 space-y-4 bg-background">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cost Savings ($ Recurring / Yr)</label>
                <input
                  id="wizard-cost-save"
                  type="number"
                  className="w-full rounded border border-border bg-surface p-3 text-sm focus:border-accent focus:outline-none"
                  placeholder="e.g. 250000"
                  value={costSaveAnnual}
                  onChange={(e) => setCostSaveAnnual(e.target.value)}
                />
              </div>
              
              {hasCostSaveClaim && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 border-l-2 border-accent pl-4">
                  <label className="text-sm font-medium text-accent">Cost Savings Source / Evidence <span className="text-accent">*</span></label>
                  <input
                    id="wizard-cost-source"
                    className={`w-full rounded border p-3 text-sm focus:outline-none ${!isCostSaveSourced ? "border-refused focus:border-refused" : "border-border focus:border-accent"}`}
                    placeholder="Link to memo, spreadsheet, or analysis..."
                    value={costSaveSource}
                    onChange={(e) => setCostSaveSource(e.target.value)}
                  />
                  {!isCostSaveSourced && <p className="text-xs text-refused">Source is required for cost-save claims.</p>}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-8">
              <button
                type="button"
                onClick={handleBack}
                className="rounded px-4 py-2.5 font-medium text-muted hover:text-foreground"
              >
                ← Back
              </button>
              <button
                id="wizard-submit-btn"
                type="submit"
                disabled={pending || !canSubmit}
                className="rounded bg-accent px-8 py-2.5 font-bold tracking-wide text-background shadow-lg hover:opacity-90 disabled:opacity-50 disabled:shadow-none"
              >
                {pending ? "Submitting to Gate..." : "Submit to Board →"}
              </button>
            </div>
          </div>
        )}

      </form>

      {refusal && (
        <div className="animate-in fade-in slide-in-from-bottom-2 rounded border border-refused/40 bg-refused/10 p-4 text-sm text-refused">
          <div className="font-mono font-semibold">CADMUS REFUSED SUBMISSION</div>
          <ul className="mt-2 list-inside list-disc">
            {refusal.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="rounded border border-refused/40 bg-refused/10 p-4 font-mono text-sm text-refused">{error}</div>}
    </div>
  );
}
