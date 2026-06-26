"use client";

import { useState } from "react";

import {
  CONFIDENCE_OPTIONS,
  EMPTY_INTAKE_FORM,
  VALUE_TYPES,
  formToJson,
  type IntakeFormState,
} from "@/lib/looper/intake-form";

type Props = {
  onSubmit: (json: string) => void;
  pending: boolean;
};

const fieldClass =
  "mt-1 w-full rounded border border-border bg-black/30 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const labelClass = "font-mono text-xs uppercase text-muted";

export function IntakeForm({ onSubmit, pending }: Props) {
  const [form, setForm] = useState<IntakeFormState>(EMPTY_INTAKE_FORM);

  function set<K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(formToJson(form));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={labelClass}>Title</label>
          <input
            required
            className={fieldClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Production deferment dashboard"
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea
            required
            rows={3}
            className={fieldClass}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What you're building and why…"
          />
        </div>
        <div>
          <label className={labelClass}>Area</label>
          <input
            required
            className={fieldClass}
            value={form.area}
            onChange={(e) => set("area", e.target.value)}
            placeholder="Production"
          />
        </div>
        <div>
          <label className={labelClass}>Sponsor</label>
          <input
            required
            className={fieldClass}
            value={form.sponsor}
            onChange={(e) => set("sponsor", e.target.value)}
            placeholder="Field Ops"
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Outcome (measurable)</label>
          <input
            required
            className={fieldClass}
            value={form.outcome}
            onChange={(e) => set("outcome", e.target.value)}
            placeholder="deferment visibility dashboard"
          />
        </div>
        <div>
          <label className={labelClass}>Value type</label>
          <select
            className={fieldClass}
            value={form.valueType}
            onChange={(e) => set("valueType", e.target.value as IntakeFormState["valueType"])}
          >
            {VALUE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Business channel (optional)</label>
          <select
            className={fieldClass}
            value={form.businessImpact}
            onChange={(e) => set("businessImpact", e.target.value)}
          >
            <option value="">—</option>
            <option value="Correspondent">Correspondent</option>
            <option value="Consumer">Consumer</option>
            <option value="Servicing">Servicing</option>
          </select>
        </div>
      </div>

      <fieldset className="rounded border border-border p-4">
        <legend className="px-1 font-mono text-xs uppercase text-accent">Reach (with source)</legend>
        <div className="mt-2 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>Count</label>
            <input
              required
              type="number"
              min={1}
              className={fieldClass}
              value={form.reachValue}
              onChange={(e) => set("reachValue", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Unit</label>
            <input
              required
              className={fieldClass}
              value={form.reachUnit}
              onChange={(e) => set("reachUnit", e.target.value)}
              placeholder="engineers"
            />
          </div>
          <div>
            <label className={labelClass}>Source citation</label>
            <input
              required
              className={fieldClass}
              value={form.reachSource}
              onChange={(e) => set("reachSource", e.target.value)}
              placeholder="Headcount study Q2 2026"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded border border-border p-4">
        <legend className="px-1 font-mono text-xs uppercase text-accent">Value claims (optional)</legend>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Revenue impact ($/yr)</label>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={form.revenueImpact}
              onChange={(e) => set("revenueImpact", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Revenue source</label>
            <input
              className={fieldClass}
              value={form.revenueSource}
              onChange={(e) => set("revenueSource", e.target.value)}
              placeholder="Required if revenue &gt; 0"
            />
          </div>
          <div>
            <label className={labelClass}>Cost save ($/yr)</label>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={form.costSaveAnnual}
              onChange={(e) => set("costSaveAnnual", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Savings effective date</label>
            <input
              type="date"
              className={fieldClass}
              value={form.savingsEffectiveDate}
              onChange={(e) => set("savingsEffectiveDate", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Cost save source</label>
            <input
              className={fieldClass}
              value={form.costSaveSource}
              onChange={(e) => set("costSaveSource", e.target.value)}
              placeholder="Required if cost save &gt; 0"
            />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass}>Effort (team-weeks)</label>
          <input
            required
            type="number"
            min={1}
            className={fieldClass}
            value={form.effortTeamWeeks}
            onChange={(e) => set("effortTeamWeeks", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Delivery confidence</label>
          <select
            className={fieldClass}
            value={form.deliveryConfidence}
            onChange={(e) => set("deliveryConfidence", Number(e.target.value))}
          >
            {CONFIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Value confidence</label>
          <select
            className={fieldClass}
            value={form.valueConfidence}
            onChange={(e) => set("valueConfidence", Number(e.target.value))}
          >
            {CONFIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent/20 px-4 py-2 font-mono text-sm text-accent hover:bg-accent/30 disabled:opacity-50"
      >
        {pending ? "Running…" : "Intake + Prioritize"}
      </button>
    </form>
  );
}