"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { TEMPLATES } from "@/lib/templates";
import { EmptyState, useToasts } from "./Toasts";

interface Row {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  response_count: number;
}

type Sort = "newest" | "oldest" | "updated" | "name" | "responses";

export default function Dashboard({ email, role, initialForms }: { email: string; role: "user" | "admin"; initialForms: Row[] }) {
  const router = useRouter();
  const { push, node } = useToasts();
  const [forms, setForms] = useState(initialForms);
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [sort, setSort] = useState<Sort>("newest");

  const totalResponses = forms.reduce((n, f) => n + f.response_count, 0);
  const publishedCount = forms.filter((f) => f.published).length;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = forms.filter((f) => (!term || f.title.toLowerCase().includes(term)) && (status === "all" || (status === "published") === f.published));
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      newest: (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      oldest: (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
      updated: (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at),
      name: (a, b) => a.title.localeCompare(b.title),
      responses: (a, b) => b.response_count - a.response_count,
    };
    return [...list].sort(by[sort]);
  }, [forms, q, status, sort]);

  async function create(template?: string) {
    setBusy("new");
    const r = await api<{ id: string }>("/api/forms", { method: "POST", json: template ? { template } : {} });
    if (r.ok) router.push(`/dashboard/forms/${r.data.id}`);
    else {
      push("error", r.error!);
      setBusy(null);
    }
  }

  async function togglePublish(f: Row) {
    setBusy(f.id);
    const r = await api(`/api/forms/${f.id}`, { method: "PATCH", json: { published: !f.published } });
    if (r.ok) {
      setForms((all) => all.map((x) => (x.id === f.id ? { ...x, published: !f.published } : x)));
      push("success", f.published ? "Form unpublished" : "Form published");
    } else push("error", r.error!);
    setBusy(null);
  }

  async function duplicate(f: Row) {
    setBusy(f.id);
    const r = await api<{ id: string }>(`/api/forms/${f.id}/duplicate`, { method: "POST" });
    if (r.ok) {
      push("success", "Form duplicated");
      router.push(`/dashboard/forms/${r.data.id}`);
    } else {
      push("error", r.error!);
      setBusy(null);
    }
  }

  async function remove(f: Row) {
    if (!confirm(`Delete "${f.title}" and all its responses? This cannot be undone.`)) return;
    setBusy(f.id);
    const r = await api(`/api/forms/${f.id}`, { method: "DELETE" });
    if (r.ok) {
      setForms((all) => all.filter((x) => x.id !== f.id));
      push("success", "Form deleted");
    } else push("error", r.error!);
    setBusy(null);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-display text-xl font-extrabold text-indigo-600">ChatForm</Link>
          <div className="flex items-center gap-3 text-sm">
            {role === "admin" && <Link href="/admin" className="btn btn-ghost">Admin</Link>}
            <span className="hidden text-gray-500 sm:inline">{email}</span>
            <button onClick={logout} className="btn btn-ghost">Log out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Your forms</h1>
          <button onClick={() => setPicker(true)} disabled={busy === "new"} className="btn btn-primary">{busy === "new" ? "Creating…" : "+ New form"}</button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Total forms" value={forms.length} />
          <Stat label="Published" value={publishedCount} />
          <Stat label="Total responses" value={totalResponses} />
        </div>

        {forms.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]" role="search">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search forms by title…" aria-label="Search forms" className="input" />
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status" className="input sm:w-40">
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort forms" className="input sm:w-48">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="updated">Recently edited</option>
              <option value="name">Name (A–Z)</option>
              <option value="responses">Most responses</option>
            </select>
          </div>
        )}

        {forms.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon="📝" title="No forms yet">
              Start from a template or build one from scratch.
              <div className="mt-4"><button onClick={() => setPicker(true)} className="btn btn-primary">Create your first form</button></div>
            </EmptyState>
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon="🔎" title="No forms match your filters">
              <button onClick={() => { setQ(""); setStatus("all"); }} className="btn btn-ghost mt-3">Clear filters</button>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {shown.map((f) => (
              <li key={f.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/forms/${f.id}`} className="block truncate font-semibold hover:text-indigo-600">{f.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${f.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{f.published ? "Published" : "Draft"}</span>
                    <span>{f.response_count} response{f.response_count === 1 ? "" : "s"}</span>
                    <span>Edited {new Date(f.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/forms/${f.id}`} className="btn btn-ghost">Edit</Link>
                  <Link href={`/dashboard/forms/${f.id}?tab=responses`} className="btn btn-ghost">Responses</Link>
                  <Link href={`/dashboard/forms/${f.id}?tab=analytics`} className="btn btn-ghost">Analytics</Link>
                  <button onClick={() => duplicate(f)} disabled={busy === f.id} className="btn btn-ghost">Duplicate</button>
                  <button onClick={() => togglePublish(f)} disabled={busy === f.id} className="btn btn-ghost">{f.published ? "Unpublish" : "Publish"}</button>
                  <button onClick={() => remove(f)} disabled={busy === f.id} className="btn btn-danger" aria-label={`Delete ${f.title}`}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {picker && <TemplatePicker onPick={(t) => { setPicker(false); create(t); }} onClose={() => setPicker(false)} />}
      {node}
    </div>
  );
}

function TemplatePicker({ onPick, onClose }: { onPick: (id?: string) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="tpl-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="tpl-title" className="text-lg font-bold">Start a new form</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-2 text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button ref={first} onClick={() => onPick()} className="card p-4 text-left hover:border-indigo-400">
            <div className="text-2xl" aria-hidden="true">📄</div>
            <div className="mt-1 font-semibold">Blank form</div>
            <div className="text-sm text-gray-500">Start from scratch.</div>
          </button>
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => onPick(t.id)} className="card p-4 text-left hover:border-indigo-400">
              <div className="text-2xl" aria-hidden="true">{t.emoji}</div>
              <div className="mt-1 font-semibold">{t.name}</div>
              <div className="text-sm text-gray-500">{t.description}</div>
              <div className="mt-1 text-xs text-gray-400">{t.questions.length} questions</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
