"use client";

import type { GateField, IntakeGate } from "@/lib/looper/gates";

const fieldClass =
  "mt-1 w-full rounded border border-border bg-black/30 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const labelClass = "font-mono text-xs uppercase text-muted";

const SECTION_LABEL: Record<string, string> = {
  idea: "Your idea",
  gate: "This front door",
  engine: "Scoring inputs",
};

type Props = {
  gate: IntakeGate;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
};

export function GateForm({ gate, values, onChange, disabled }: Props) {
  const sections = ["idea", "gate", "engine"] as const;

  return (
    <div className="space-y-8">
      {sections.map((section) => {
        const fields = gate.fields.filter((f) => (f.section ?? "idea") === section);
        if (!fields.length) return null;
        return (
          <div key={section}>
            <h2 className="font-mono text-xs uppercase text-muted">{SECTION_LABEL[section]}</h2>
            <div className="mt-3 space-y-4">
              {fields.map((f) => (
                <Field key={f.key} field={f} value={values[f.key] ?? ""} onChange={onChange} disabled={disabled} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
  disabled,
}: {
  field: GateField;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>
        {field.label}
        {field.required ? " *" : ""}
      </label>
      {field.kind === "textarea" ? (
        <textarea
          disabled={disabled}
          required={field.required}
          rows={3}
          className={fieldClass}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : field.kind === "select" ? (
        <select
          disabled={disabled}
          required={field.required}
          className={fieldClass}
          value={value || field.options?.[0]?.value || ""}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          disabled={disabled}
          required={field.required}
          type={field.kind === "number" ? "number" : field.kind === "email" ? "email" : field.kind === "date" ? "date" : "text"}
          className={fieldClass}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
      {field.hint && <p className="mt-1 text-xs text-muted">{field.hint}</p>}
    </div>
  );
}