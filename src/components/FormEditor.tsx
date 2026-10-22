"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ChatBot from "./ChatBot";
import { TYPE_LABELS, type AnswerItem, type FormData, type QuestionType } from "@/lib/types";

interface EditQ {
  key: string;
  type: QuestionType;
  label: string;
  required: boolean;
  optionsText: string;
}

let counter = 0;
const newKey = () => `k${Date.now()}_${counter++}`;
const toOptions = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean);

function toEdit(f: FormData): EditQ[] {
  return f.questions.map((q) => ({ key: q.id, type: q.type, label: q.label, required: q.required, optionsText: q.options.join("\n") }));
}

type Tab = "build" | "preview" | "responses" | "share";

export default function FormEditor({ initial, initialTab }: { initial: FormData; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [welcome, setWelcome] = useState(initial.welcome_message);
  const [completion, setCompletion] = useState(initial.completion_message);
  const [color, setColor] = useState(initial.primary_color);
  const [questions, setQuestions] = useState<EditQ[]>(toEdit(initial));
  const [published, setPublished] = useState(initial.published);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
    setMsg(null);
  };

  const updateQ = (key: string, patch: Partial<EditQ>) => {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
    setDirty(true);
    setMsg(null);
  };
  const addQ = (type: QuestionType) => {
    setQuestions((qs) => [
      ...qs,
      { key: newKey(), type, label: "", required: true, optionsText: type === "choice" ? "Option 1\nOption 2" : "" },
    ]);
    setDirty(true);
  };
  const removeQ = (key: string) => {
    setQuestions((qs) => qs.filter((q) => q.key !== key));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setDirty(true);
  };

  const save = useCallback(
    async (nextPublished?: boolean) => {
      setMsg(null);
      for (const [i, q] of questions.entries()) {
        if (!q.label.trim()) return setMsg({ kind: "error", text: `Question ${i + 1} is empty. Add some text or delete it.` });
        if (q.type === "choice" && toOptions(q.optionsText).length < 2)
          return setMsg({ kind: "error", text: `Question ${i + 1} needs at least 2 options (one per line).` });
      }
      setSaving(true);
      const res = await fetch(`/api/forms/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          welcome_message: welcome,
          completion_message: completion,
          primary_color: color,
          published: nextPublished ?? published,
          questions: questions.map((q) => ({
            type: q.type,
            label: q.label,
            required: q.required,
            options: q.type === "choice" ? toOptions(q.optionsText) : [],
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) return setMsg({ kind: "error", text: data.error || "Could not save" });
      setQuestions(toEdit(data));
      setPublished(data.published);
      setDirty(false);
      setMsg({ kind: "ok", text: nextPublished === undefined ? "Saved ✓" : data.published ? "Published ✓" : "Unpublished ✓" });
    },
    [questions, title, description, welcome, completion, color, published, initial.id]
  );

  const previewConfig = useMemo(
    () => ({
      title: title || "Untitled form",
      welcome_message: welcome,
      completion_message: completion,
      primary_color: color,
      questions: questions.map((q) => ({
        id: q.key,
        type: q.type,
        label: q.label || "(empty question)",
        required: q.required,
        options: toOptions(q.optionsText),
      })),
    }),
    [title, welcome, completion, color, questions]
  );
  const previewSubmit = useCallback(async () => null, []);

  const tabs: [Tab, string][] = [["build", "Build"], ["preview", "Preview"], ["responses", "Responses"], ["share", "Share & embed"]];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-indigo-600">← Dashboard</Link>
          <span className="min-w-0 flex-1 truncate font-semibold">{title || "Untitled form"}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {published ? "Published" : "Draft"}
          </span>
          <button onClick={() => save()} disabled={saving || !dirty} className="btn btn-ghost">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => save(!published)} disabled={saving} className="btn btn-primary">{published ? "Unpublish" : "Save & publish"}</button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
          {tabs.map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {msg && (
          <p role="status" className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </p>
        )}
        {dirty && <p className="mb-4 text-xs text-amber-600">You have unsaved changes.</p>}

        {tab === "build" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-4">
              <div className="card space-y-3 p-4">
                <Field label="Form title"><input className="input" value={title} maxLength={150} onChange={(e) => touch(setTitle)(e.target.value)} /></Field>
                <Field label="Description (optional)"><textarea className="input" rows={2} maxLength={500} value={description} onChange={(e) => touch(setDescription)(e.target.value)} /></Field>
              </div>

              {questions.length === 0 && <div className="card p-6 text-center text-sm text-gray-500">No questions yet. Add one below.</div>}

              {questions.map((q, i) => (
                <div key={q.key} className="card space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{i + 1}</span>
                    <select
                      aria-label="Question type"
                      className="input !w-auto"
                      value={q.type}
                      onChange={(e) => {
                        const type = e.target.value as QuestionType;
                        updateQ(q.key, { type, optionsText: type === "choice" && !q.optionsText ? "Option 1\nOption 2" : q.optionsText });
                      }}
                    >
                      {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                    <div className="ml-auto flex gap-1">
                      <button className="btn btn-ghost !px-2.5" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                      <button className="btn btn-ghost !px-2.5" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Move down">↓</button>
                      <button className="btn btn-danger !px-2.5" onClick={() => removeQ(q.key)} aria-label="Delete question">🗑</button>
                    </div>
                  </div>
                  <input className="input" placeholder="Type your question…" maxLength={300} value={q.label} onChange={(e) => updateQ(q.key, { label: e.target.value })} />
                  {q.type === "choice" && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Options (one per line, max 10)</label>
                      <textarea className="input" rows={3} value={q.optionsText} onChange={(e) => updateQ(q.key, { optionsText: e.target.value })} />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={q.required} onChange={(e) => updateQ(q.key, { required: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
                    Required
                  </label>
                </div>
              ))}

              <div className="card p-4">
                <p className="mb-2 text-sm font-medium">Add a question</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                    <button key={t} onClick={() => addQ(t)} className="btn btn-ghost">+ {TYPE_LABELS[t]}</button>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="card space-y-3 p-4">
                <h2 className="font-semibold">Chatbot appearance</h2>
                <Field label="Welcome message"><textarea className="input" rows={3} maxLength={300} value={welcome} onChange={(e) => touch(setWelcome)(e.target.value)} /></Field>
                <Field label="Completion message"><textarea className="input" rows={3} maxLength={300} value={completion} onChange={(e) => touch(setCompletion)(e.target.value)} /></Field>
                <Field label="Brand color">
                  <div className="flex items-center gap-2">
                    <input type="color" value={color} onChange={(e) => touch(setColor)(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-gray-300" aria-label="Brand color" />
                    <code className="text-xs text-gray-500">{color}</code>
                  </div>
                </Field>
              </div>
              <button className="btn btn-ghost w-full" onClick={() => setTab("preview")}>👁 Preview chatbot</button>
            </aside>
          </div>
        )}

        {tab === "preview" && (
          <div className="mx-auto max-w-sm">
            <p className="mb-3 text-center text-sm text-gray-500">Preview only — answers here are not saved. Reflects your unsaved edits.</p>
            <div className="h-[600px] overflow-hidden rounded-2xl border border-gray-200 shadow-lg">
              <ChatBot config={previewConfig} onSubmit={previewSubmit} restartable />
            </div>
          </div>
        )}

        {tab === "responses" && <Responses formId={initial.id} />}
        {tab === "share" && <Share slug={initial.slug} published={published} dirty={dirty} />}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Responses({ formId }: { formId: string }) {
  const [rows, setRows] = useState<{ id: string; answers: AnswerItem[]; submitted_at: string }[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/forms/${formId}/responses`);
    if (res.ok) setRows(await res.json());
    else setError("Could not load responses");
  }, [formId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{rows.length} submission{rows.length === 1 ? "" : "s"}</h2>
        <button onClick={load} className="btn btn-ghost">↻ Refresh</button>
      </div>
      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">No responses yet. Publish the form and share the link or embed the widget.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold text-gray-700">#{rows.length - i}</span>
                <time dateTime={r.submitted_at}>{new Date(r.submitted_at).toLocaleString()}</time>
              </div>
              <dl className="space-y-2">
                {r.answers.map((a) => (
                  <div key={a.question_id}>
                    <dt className="text-xs font-medium text-gray-500">{a.label}</dt>
                    <dd className="break-words text-sm">{a.value || <span className="text-gray-400">— skipped —</span>}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Share({ slug, published, dirty }: { slug: string; published: boolean; dirty: boolean }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/f/${slug}`;
  const snippet = `<script src="${origin}/embed.js" data-form="${slug}" async></script>`;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!published && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This form is a draft. Publish it for the link and widget to work.</p>}
      {dirty && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Unsaved changes won&apos;t appear to visitors until you save.</p>}
      <div className="card space-y-2 p-4">
        <h2 className="font-semibold">Public link</h2>
        <CopyRow text={url} />
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">Open in new tab ↗</a>
      </div>
      <div className="card space-y-2 p-4">
        <h2 className="font-semibold">Embed the chatbot widget</h2>
        <p className="text-sm text-gray-600">Paste this snippet just before the closing <code>&lt;/body&gt;</code> tag of any website.</p>
        <CopyRow text={snippet} multiline />
      </div>
    </div>
  );
}

function CopyRow({ text, multiline }: { text: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: user can select manually */
    }
  }
  return (
    <div className="flex items-start gap-2">
      <code className={`flex-1 rounded-lg bg-gray-100 px-3 py-2 text-xs ${multiline ? "break-all" : "truncate"}`}>{text}</code>
      <button onClick={copy} className="btn btn-ghost shrink-0">{copied ? "Copied ✓" : "Copy"}</button>
    </div>
  );
}
