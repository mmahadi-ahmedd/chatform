"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Row {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  created_at: string;
  response_count: number;
}

export default function Dashboard({ email, initialForms }: { email: string; initialForms: Row[] }) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const totalResponses = forms.reduce((n, f) => n + f.response_count, 0);
  const publishedCount = forms.filter((f) => f.published).length;

  async function create() {
    setBusy("new");
    const res = await fetch("/api/forms", { method: "POST" });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/dashboard/forms/${id}`);
    } else {
      setError("Could not create form");
      setBusy(null);
    }
  }

  async function togglePublish(f: Row) {
    setBusy(f.id);
    setError("");
    const res = await fetch(`/api/forms/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !f.published }),
    });
    if (res.ok) setForms((all) => all.map((x) => (x.id === f.id ? { ...x, published: !f.published } : x)));
    else setError((await res.json().catch(() => ({}))).error || "Could not update form");
    setBusy(null);
  }

  async function remove(f: Row) {
    if (!confirm(`Delete "${f.title}" and all its responses? This cannot be undone.`)) return;
    setBusy(f.id);
    const res = await fetch(`/api/forms/${f.id}`, { method: "DELETE" });
    if (res.ok) setForms((all) => all.filter((x) => x.id !== f.id));
    else setError("Could not delete form");
    setBusy(null);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-indigo-600">💬 ChatForm</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-gray-500 sm:inline">{email}</span>
            <button onClick={logout} className="btn btn-ghost">Log out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Your forms</h1>
          <button onClick={create} disabled={busy === "new"} className="btn btn-primary">+ New form</button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Total forms" value={forms.length} />
          <Stat label="Published" value={publishedCount} />
          <Stat label="Total responses" value={totalResponses} />
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {forms.length === 0 ? (
          <div className="card mt-6 p-10 text-center">
            <p className="text-4xl">📝</p>
            <p className="mt-2 font-semibold">No forms yet</p>
            <p className="text-sm text-gray-500">Create your first chat-style form to get started.</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {forms.map((f) => (
              <li key={f.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/forms/${f.id}`} className="block truncate font-semibold hover:text-indigo-600">{f.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${f.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {f.published ? "Published" : "Draft"}
                    </span>
                    <span>{f.response_count} response{f.response_count === 1 ? "" : "s"}</span>
                    <span>Created {new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/forms/${f.id}`} className="btn btn-ghost">Edit</Link>
                  <Link href={`/dashboard/forms/${f.id}?tab=responses`} className="btn btn-ghost">Responses</Link>
                  <button onClick={() => togglePublish(f)} disabled={busy === f.id} className="btn btn-ghost">
                    {f.published ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => remove(f)} disabled={busy === f.id} className="btn btn-danger">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}
