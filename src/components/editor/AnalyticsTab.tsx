"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { BarList, DailyChart, type DayPoint } from "../Charts";
import { ErrorState, Skeleton } from "../Toasts";

interface QStat {
  id: string; label: string; type: string; answered: number; skipped: number; shown: number;
  distribution: { value: string; count: number }[]; average: number | null;
}
interface Data {
  range: { from: string; to: string };
  totals: { views: number; starts: number; completed: number; completionRate: number | null; abandonmentRate: number | null; startRate: number | null };
  daily: DayPoint[];
  questions: QStat[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400000));
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

export default function AnalyticsTab({ formId }: { formId: string }) {
  const [preset, setPreset] = useState<"7" | "30" | "90" | "custom">("30");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(iso(new Date()));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function choose(p: "7" | "30" | "90") {
    setPreset(p);
    setFrom(daysAgo(Number(p) - 1));
    setTo(iso(new Date()));
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const r = await api<Data>(`/api/forms/${formId}/analytics?from=${from}&to=${to}`);
    if (r.ok) setData(r.data);
    else setError(r.error!);
    setLoading(false);
  }, [formId, from, to]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Date range" className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
          {(["7", "30", "90"] as const).map((p) => (
            <button key={p} onClick={() => choose(p)} aria-pressed={preset === p} className={`rounded-md px-3 py-1.5 font-medium ${preset === p ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Last {p} days</button>
          ))}
        </div>
        <label className="text-xs text-gray-600">From<input type="date" className="input mt-1" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} /></label>
        <label className="text-xs text-gray-600">To<input type="date" className="input mt-1" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} /></label>
        <a className="btn btn-ghost ml-auto" href={`/api/forms/${formId}/export?from=${from}&to=${to}`} download>⬇ Export CSV</a>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <Skeleton rows={3} /> : (
        <div className={loading ? "space-y-6 opacity-60" : "space-y-6"}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Views" value={data.totals.views} hint="Chat opened" />
            <Stat label="Conversations started" value={data.totals.starts} hint="Answered at least one question" />
            <Stat label="Completed" value={data.totals.completed} hint="Responses saved" />
            <Stat label="Completion rate" value={pct(data.totals.completionRate)} hint="Completed ÷ started" />
            <Stat label="Abandonment rate" value={pct(data.totals.abandonmentRate)} hint="Started but not finished" />
          </div>

          {data.totals.views === 0 && data.totals.completed === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-500">No activity in this period. Views are counted when someone opens your chat.</div>
          ) : (
            <>
              <section className="card p-4" aria-labelledby="trend">
                <h2 id="trend" className="mb-2 font-semibold">Activity per day</h2>
                <DailyChart data={data.daily} />
              </section>
              <section className="card p-4" aria-labelledby="funnel">
                <h2 id="funnel" className="mb-3 font-semibold">Funnel</h2>
                <BarList items={[{ label: "Viewed", value: data.totals.views }, { label: "Started", value: data.totals.starts }, { label: "Completed", value: data.totals.completed }]} />
                <p className="mt-3 text-xs text-gray-500">{pct(data.totals.startRate)} of people who opened the chat answered a question.</p>
              </section>
            </>
          )}

          <section aria-labelledby="qstats">
            <h2 id="qstats" className="mb-3 font-semibold">Question statistics</h2>
            {data.questions.length === 0 ? <p className="text-sm text-gray-500">This form has no questions.</p> : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.questions.map((q, i) => (
                  <div key={q.id} className="card p-4">
                    <h3 className="text-sm font-semibold">{i + 1}. {q.label}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {q.shown === 0 ? "No one has seen this question in this period." : `${q.answered} answered · ${q.skipped} skipped · seen in ${q.shown} response${q.shown === 1 ? "" : "s"}`}
                    </p>
                    {q.average !== null && <p className="mt-2 text-2xl font-bold">{q.average.toFixed(1)} <span className="text-sm font-normal text-gray-500">average</span></p>}
                    {q.distribution.length > 0 && q.answered > 0 && <div className="mt-3"><BarList items={q.distribution.map((d) => ({ label: d.value, value: d.count }))} /></div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-gray-400">{hint}</div>
    </div>
  );
}
