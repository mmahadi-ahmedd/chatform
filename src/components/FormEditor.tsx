"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { validateForm } from "@/lib/formschema";
import { TYPE_LABELS, type FormData, type QuestionType } from "@/lib/types";
import { uuid } from "@/lib/uuid";
import { useToasts } from "./Toasts";
import AnalyticsTab from "./editor/AnalyticsTab";
import DesignPanel from "./editor/DesignPanel";
import IntegrationsTab from "./editor/IntegrationsTab";
import PreviewTab from "./editor/PreviewTab";
import QuestionCard from "./editor/QuestionCard";
import ResponsesTab from "./editor/ResponsesTab";
import ShareTab from "./editor/ShareTab";
import { fromForm, hasOptions, normalizeLogic, snapshot, toPayload, type Draft, type EditQ } from "./editor/model";

export type Tab = "build" | "preview" | "responses" | "analytics" | "integrations" | "share";
const TABS: [Tab, string][] = [["build", "Build"], ["preview", "Preview"], ["responses", "Responses"], ["analytics", "Analytics"], ["integrations", "Integrations"], ["share", "Share & embed"]];
const AUTOSAVE_MS = 2500;

export default function FormEditor({ initial, initialTab }: { initial: FormData; initialTab: Tab }) {
  const router = useRouter();
  const { push, node } = useToasts();
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [d, setD] = useState<Draft>(() => fromForm(initial));
  const [published, setPublished] = useState(initial.published);
  const saved = useRef(snapshot(fromForm(initial)));
  const basedOn = useRef(initial.updated_at ?? "");
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "paused" | "error"; text: string }>({ kind: "idle", text: "" });
  const [recover, setRecover] = useState<{ draft: Draft; at: number } | null>(null);
  const saving = useRef(false);

  const dirty = snapshot(d) !== saved.current;
  const storageKey = `chatform:draft:${initial.id}`;

  // ---- draft recovery: offer to restore unsaved edits from a previous session ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const s = JSON.parse(raw) as { data: Draft; based_on: string; at: number };
      if (s.based_on === basedOn.current && snapshot(s.data) !== saved.current) setRecover({ draft: s.data, at: s.at });
      else localStorage.removeItem(storageKey);
    } catch { /* storage unavailable or corrupt: ignore */ }
  }, [storageKey]);

  // ---- keep a local copy of unsaved edits (survives refresh / crash / lost connection) ----
  useEffect(() => {
    if (recover) return;
    const t = setTimeout(() => {
      try {
        if (snapshot(d) !== saved.current) localStorage.setItem(storageKey, JSON.stringify({ data: d, based_on: basedOn.current, at: Date.now() }));
        else localStorage.removeItem(storageKey);
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(t);
  }, [d, recover, storageKey]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (snapshot(d) !== saved.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [d]);

  const set = useCallback(<K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v })), []);

  const setQuestions = useCallback((next: EditQ[]) => {
    const { questions, cleared } = normalizeLogic(next);
    setD((x) => ({ ...x, questions }));
    if (cleared.length) push("error", `Removed the condition on "${cleared[0]}": it must depend on an earlier question.`);
  }, [push]);

  const updateQ = (id: string, patch: Partial<EditQ>) => setQuestions(d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const addQ = (type: QuestionType) =>
    setQuestions([...d.questions, { id: uuid(), type, label: "", required: true, optionsText: hasOptions(type) ? "Option 1\nOption 2" : "", config: type === "rating" ? { max: 5 } : {}, logic: null }]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.questions.length) return;
    const copy = [...d.questions];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setQuestions(copy);
  };

  /** Returns an error message if the draft can't be saved yet. */
  function problem(draft: Draft): string | null {
    const payload = toPayload(draft);
    for (const [i, q] of payload.questions.entries()) if (!q.label.trim()) return `Question ${i + 1} is empty. Add some text or delete it.`;
    if (!draft.title.trim()) return "The form needs a title.";
    for (const [i, q] of draft.questions.entries()) if (q.logic && !q.logic.value) return `Question ${i + 1}: choose a value for its condition.`;
    return validateForm(payload.questions as never);
  }

  const save = useCallback(
    async (opts: { publish?: boolean; auto?: boolean } = {}) => {
      if (saving.current) return;
      const sent = d;
      const bad = problem(sent);
      if (bad) {
        if (opts.auto) setStatus({ kind: "paused", text: `Autosave paused: ${bad}` });
        else { setStatus({ kind: "error", text: bad }); push("error", bad); }
        return;
      }
      saving.current = true;
      setStatus({ kind: "saving", text: "Saving…" });
      const r = await api<FormData>(`/api/forms/${initial.id}`, { method: "PUT", json: toPayload(sent, opts.publish) });
      saving.current = false;
      if (!r.ok) {
        setStatus({ kind: "error", text: r.error! });
        if (!opts.auto) push("error", r.error!);
        return;
      }
      saved.current = snapshot(sent);
      basedOn.current = r.data.updated_at ?? "";
      setPublished(r.data.published);
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      setStatus({ kind: "saved", text: `All changes saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` });
      if (opts.publish !== undefined) push("success", r.data.published ? "Form published" : "Form unpublished");
      else if (!opts.auto) push("success", "Saved");
      router.refresh();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, initial.id, storageKey, push]
  );

  // ---- autosave: drafts only. Published forms are live, so they need an explicit Save. ----
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dirty || published || recover) return;
    setStatus((s) => (s.kind === "paused" || s.kind === "error" ? s : { kind: "idle", text: "Unsaved changes" }));
    const t = setTimeout(() => saveRef.current({ auto: true }), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [d, dirty, published, recover]);

  async function duplicate() {
    const r = await api<{ id: string }>(`/api/forms/${initial.id}/duplicate`, { method: "POST" });
    if (r.ok) { push("success", "Form duplicated"); router.push(`/dashboard/forms/${r.data.id}`); } else push("error", r.error!);
  }

  const setTab = (t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, "", `?tab=${t}`);
  };

  const statusText = useMemo(() => {
    if (status.kind === "saving") return "Saving…";
    if (dirty) return published ? "Unsaved changes (published forms save only when you click Save)" : status.kind === "paused" || status.kind === "error" ? status.text : "Unsaved changes";
    return status.kind === "saved" ? status.text : "";
  }, [status, dirty, published]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-indigo-600">← Dashboard</Link>
          <span className="min-w-0 flex-1 truncate font-semibold">{d.title || "Untitled form"}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{published ? "Published" : "Draft"}</span>
          <button onClick={duplicate} className="btn btn-ghost">Duplicate</button>
          <button onClick={() => save()} disabled={status.kind === "saving" || !dirty} className="btn btn-ghost">Save</button>
          <button onClick={() => save({ publish: !published })} disabled={status.kind === "saving"} className="btn btn-primary">{published ? "Unpublish" : "Save & publish"}</button>
        </div>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4">
          <div role="tablist" aria-label="Form sections" className="flex gap-1 overflow-x-auto">
            {TABS.map(([t, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{label}</button>
            ))}
          </div>
          <span className={`hidden shrink-0 text-xs md:inline ${status.kind === "error" || status.kind === "paused" ? "text-amber-700" : "text-gray-500"}`} role="status" aria-live="polite">{statusText}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {recover && (
          <div role="alertdialog" aria-label="Recover unsaved draft" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
            <span>We found unsaved changes from {new Date(recover.at).toLocaleString()}. Restore them?</span>
            <span className="flex gap-2">
              <button className="btn btn-primary" onClick={() => { setD(recover.draft); setRecover(null); }}>Restore draft</button>
              <button className="btn btn-ghost" onClick={() => { try { localStorage.removeItem(storageKey); } catch { /* ignore */ } setRecover(null); }}>Discard</button>
            </span>
          </div>
        )}
        <p className="mb-3 text-xs md:hidden" role="status">{statusText}</p>

        {tab === "build" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-4" aria-label="Questions">
              <div className="card space-y-3 p-4">
                <label className="block"><span className="mb-1 block text-sm font-medium">Form title</span><input className="input" maxLength={150} value={d.title} onChange={(e) => set("title", e.target.value)} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium">Description (optional, for your reference)</span><textarea className="input" rows={2} maxLength={500} value={d.description} onChange={(e) => set("description", e.target.value)} /></label>
              </div>

              {d.questions.length === 0 && <div className="card p-6 text-center text-sm text-gray-500">No questions yet. Add one below.</div>}
              {d.questions.map((q, i) => (
                <QuestionCard key={q.id} q={q} index={i} all={d.questions} onChange={(p) => updateQ(q.id, p)} onMove={(dir) => move(i, dir)} onRemove={() => setQuestions(d.questions.filter((x) => x.id !== q.id))} />
              ))}

              <div className="card p-4">
                <p className="mb-2 text-sm font-medium">Add a question</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <button key={t} onClick={() => addQ(t)} className="btn btn-ghost">+ {TYPE_LABELS[t]}</button>)}
                </div>
              </div>
            </section>
            <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
              <DesignPanel d={d} set={set} push={push} />
              <button className="btn btn-ghost w-full" onClick={() => setTab("preview")}>👁 Preview chatbot</button>
            </aside>
          </div>
        )}
        {tab === "preview" && <PreviewTab d={d} />}
        {tab === "responses" && <ResponsesTab formId={initial.id} push={push} />}
        {tab === "analytics" && <AnalyticsTab formId={initial.id} />}
        {tab === "integrations" && <IntegrationsTab formId={initial.id} push={push} />}
        {tab === "share" && <ShareTab slug={initial.slug} published={published} dirty={dirty} />}
      </main>
      {node}
    </div>
  );
}
