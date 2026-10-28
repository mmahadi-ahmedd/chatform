"use client";

import { TYPE_LABELS, type LogicOp, type QuestionType } from "@/lib/types";
import { OPS, hasOptions, toOptions, type EditQ } from "./model";

const PATTERNS = [
  { label: "Phone number", pattern: "^\\+?[0-9 ()-]{7,15}$", message: "Enter a valid phone number." },
  { label: "Numbers only", pattern: "^[0-9]+$", message: "Use digits only." },
  { label: "Letters only", pattern: "^[A-Za-z ]+$", message: "Use letters only." },
];

export default function QuestionCard({
  q, index, all, onChange, onMove, onRemove,
}: {
  q: EditQ;
  index: number;
  all: EditQ[];
  onChange: (patch: Partial<EditQ>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const earlier = all.slice(0, index);
  const ref = q.logic ? earlier.find((x) => x.id === q.logic!.question_id) : undefined;
  const setConfig = (patch: Partial<EditQ["config"]>) => onChange({ config: { ...q.config, ...patch } });

  function refValues(r: EditQ): string[] | null {
    if (hasOptions(r.type)) return toOptions(r.optionsText);
    if (r.type === "yesno") return ["Yes", "No"];
    if (r.type === "rating") return Array.from({ length: r.config.max ?? 5 }, (_, i) => String(i + 1));
    return null;
  }
  const values = ref ? refValues(ref) : null;
  const staleValue = ref && values && q.logic && q.logic.value && !values.includes(q.logic.value);

  return (
    <div className="card space-y-3 p-4" role="group" aria-label={`Question ${n}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700" aria-hidden="true">{n}</span>
        <select
          aria-label={`Question ${n} type`}
          className="input !w-auto"
          value={q.type}
          onChange={(e) => {
            const type = e.target.value as QuestionType;
            onChange({ type, optionsText: hasOptions(type) && !q.optionsText ? "Option 1\nOption 2" : q.optionsText, config: {} });
          }}
        >
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <div className="ml-auto flex gap-1">
          <button className="btn btn-ghost !px-2.5" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move question ${n} up`}>↑</button>
          <button className="btn btn-ghost !px-2.5" onClick={() => onMove(1)} disabled={index === all.length - 1} aria-label={`Move question ${n} down`}>↓</button>
          <button className="btn btn-danger !px-2.5" onClick={onRemove} aria-label={`Delete question ${n}`}>🗑</button>
        </div>
      </div>

      <input className="input" aria-label={`Question ${n} text`} placeholder="Type your question…" maxLength={300} value={q.label} onChange={(e) => onChange({ label: e.target.value })} />

      {hasOptions(q.type) && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor={`opt-${q.id}`}>Options (one per line, max 20)</label>
          <textarea id={`opt-${q.id}`} className="input" rows={3} value={q.optionsText} onChange={(e) => onChange({ optionsText: e.target.value })} />
        </div>
      )}

      {q.type === "rating" && (
        <label className="flex items-center gap-2 text-sm">
          Scale
          <select className="input !w-auto" value={q.config.max ?? 5} onChange={(e) => setConfig({ max: Number(e.target.value) })}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((m) => <option key={m} value={m}>1 to {m} stars</option>)}
          </select>
        </label>
      )}

      {q.type === "date" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Earliest date (optional)<input type="date" className="input mt-1" value={q.config.min_date ?? ""} onChange={(e) => setConfig({ min_date: e.target.value || undefined })} /></label>
          <label className="text-sm">Latest date (optional)<input type="date" className="input mt-1" value={q.config.max_date ?? ""} onChange={(e) => setConfig({ max_date: e.target.value || undefined })} /></label>
        </div>
      )}

      {q.type === "file" && <p className="text-xs text-gray-500">Visitors can upload PNG, JPG, GIF, WebP, PDF, TXT or CSV files up to 2 MB. Only you can download them.</p>}

      {q.type === "text" && (
        <details className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">Validation rules</summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>Min length<input type="number" min={0} max={2000} className="input mt-1" value={q.config.min_length ?? ""} onChange={(e) => setConfig({ min_length: e.target.value ? Number(e.target.value) : undefined })} /></label>
              <label>Max length<input type="number" min={1} max={2000} className="input mt-1" value={q.config.max_length ?? ""} onChange={(e) => setConfig({ max_length: e.target.value ? Number(e.target.value) : undefined })} /></label>
            </div>
            <label className="block">Pattern (optional regular expression)
              <input className="input mt-1 font-mono" maxLength={100} placeholder="e.g. ^[0-9]{10}$" value={q.config.pattern ?? ""} onChange={(e) => setConfig({ pattern: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-2">
              {PATTERNS.map((p) => (
                <button key={p.label} type="button" className="btn btn-ghost !px-2 !py-1 !text-xs" onClick={() => setConfig({ pattern: p.pattern, pattern_message: p.message })}>{p.label}</button>
              ))}
            </div>
            {q.config.pattern && (
              <label className="block">Message when it doesn&apos;t match
                <input className="input mt-1" maxLength={120} value={q.config.pattern_message ?? ""} onChange={(e) => setConfig({ pattern_message: e.target.value })} />
              </label>
            )}
          </div>
        </details>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={q.required} onChange={(e) => onChange({ required: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
        Required
      </label>

      {index > 0 && (
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={!!q.logic}
              onChange={(e) => onChange({ logic: e.target.checked ? { question_id: earlier[earlier.length - 1].id, op: "equals", value: "" } : null })}
            />
            Only show this question if…
          </label>
          {q.logic && (
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
              <select aria-label={`Question ${n} condition: depends on`} className="input" value={q.logic.question_id} onChange={(e) => onChange({ logic: { question_id: e.target.value, op: "equals", value: "" } })}>
                {earlier.map((x, i) => <option key={x.id} value={x.id}>{i + 1}. {x.label || "(untitled)"}</option>)}
              </select>
              <select aria-label={`Question ${n} condition: operator`} className="input" value={q.logic.op} onChange={(e) => onChange({ logic: { ...q.logic!, op: e.target.value as LogicOp } })}>
                {OPS[ref?.type === "rating" ? "rating" : "other"].map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
              </select>
              {values ? (
                <select aria-label={`Question ${n} condition: value`} className="input" value={q.logic.value} onChange={(e) => onChange({ logic: { ...q.logic!, value: e.target.value } })}>
                  <option value="">Choose…</option>
                  {values.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input aria-label={`Question ${n} condition: value`} className="input" maxLength={100} placeholder="Answer equals…" value={q.logic.value} onChange={(e) => onChange({ logic: { ...q.logic!, value: e.target.value } })} />
              )}
            </div>
          )}
          {q.logic && (!q.logic.value || staleValue) && (
            <p className="mt-2 text-xs text-amber-700" role="alert">{staleValue ? "That value no longer exists in the question above. Choose another." : "Choose a value for this condition."}</p>
          )}
        </div>
      )}
    </div>
  );
}
