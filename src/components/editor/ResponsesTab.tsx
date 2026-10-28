"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { AnswerItem } from "@/lib/types";
import { EmptyState, ErrorState, Skeleton } from "../Toasts";

interface Row {
  id: string;
  answers: AnswerItem[];
  submitted_at: string;
}
interface Result {
  rows: Row[];
  total: number;
  page: number;
  pages: number;
}

export default function ResponsesTab({ formId, push }: { formId: string; push: (k: "success" | "error", t: string) => void }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setDq(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (dq) params.set("q", dq);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const exportQs = params.toString();
  params.set("sort", sort);
  params.set("page", String(page));
  const key = params.toString();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const r = await api<Result>(`/api/forms/${formId}/responses?${key}`);
    if (r.ok) setRes(r.data);
    else setError(r.error!);
    setLoading(false);
  }, [formId, key]);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this response? This cannot be undone.")) return;
    const r = await api(`/api/forms/${formId}/responses/${id}`, { method: "DELETE" });
    if (r.ok) { push("success", "Response deleted"); load(); } else push("error", r.error!);
  }

  const filtered = !!(dq || from || to);
  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <input type="search" className="input" placeholder="Search answers…" aria-label="Search answers" value={q} onChange={(e) => setQ(e.target.value)} />
        <input type="date" className="input" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="input" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <select className="input" aria-label="Sort responses" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <a className="btn btn-ghost" href={`/api/forms/${formId}/export${exportQs ? `?${exportQs}` : ""}`} download>⬇ Export CSV</a>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : loading && !res ? <Skeleton rows={3} /> : res && res.rows.length === 0 ? (
        <EmptyState icon={filtered ? "🔎" : "📭"} title={filtered ? "No responses match your filters" : "No responses yet"}>
          {filtered ? "Try a different search or date range." : "Publish the form and share the link or embed the widget to start collecting answers."}
        </EmptyState>
      ) : res && (
        <>
          <p className="mb-3 text-sm text-gray-600" aria-live="polite">{res.total} response{res.total === 1 ? "" : "s"}{filtered ? " match" : ""}</p>
          <ul className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
            {res.rows.map((r, i) => (
              <li key={r.id} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">#{sort === "newest" ? res.total - (res.page - 1) * 25 - i : (res.page - 1) * 25 + i + 1}</span>
                  <span className="flex items-center gap-3">
                    <time dateTime={r.submitted_at}>{new Date(r.submitted_at).toLocaleString()}</time>
                    <button onClick={() => remove(r.id)} className="text-red-600 hover:underline" aria-label="Delete this response">Delete</button>
                  </span>
                </div>
                <dl className="space-y-2">
                  {r.answers.map((a) => (
                    <div key={a.question_id}>
                      <dt className="text-xs font-medium text-gray-500">{a.label}</dt>
                      <dd className="break-words text-sm">
                        {!a.value ? <span className="text-gray-400">skipped</span> : a.file_id ? <a className="text-indigo-600 underline" href={`/api/uploads/${a.file_id}`}>📎 {a.value}</a> : a.value}
                      </dd>
                    </div>
                  ))}
                  {r.answers.length === 0 && <p className="text-sm text-gray-400">No answers recorded.</p>}
                </dl>
              </li>
            ))}
          </ul>
          {res.pages > 1 && (
            <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button>
              <span className="text-sm text-gray-500">Page {res.page} of {res.pages}</span>
              <button className="btn btn-ghost" disabled={page >= res.pages} onClick={() => setPage(page + 1)}>Next →</button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
