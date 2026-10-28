"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { EmptyState, useToasts } from "./Toasts";

interface Row {
  id: string; email: string; role: "user" | "admin"; suspended: boolean;
  created_at: string; last_login_at: string | null; forms: number; responses: number;
}

export default function UsersTable({ rows: initial, selfId }: { rows: Row[]; selfId: string }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const { push, node } = useToasts();

  async function toggle(u: Row) {
    const next = !u.suspended;
    if (next && !confirm(`Suspend ${u.email}? They will be signed out and their public forms will stop working.`)) return;
    setBusy(u.id);
    const r = await api(`/api/admin/users/${u.id}`, { method: "PATCH", json: { suspended: next } });
    setBusy(null);
    if (r.ok) {
      setRows((all) => all.map((x) => (x.id === u.id ? { ...x, suspended: next } : x)));
      push("success", next ? `${u.email} suspended` : `${u.email} reactivated`);
    } else push("error", r.error!);
  }

  if (rows.length === 0) return <div className="mt-4"><EmptyState icon="🔎" title="No users found" /></div>;
  return (
    <div className="card mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Registered users</caption>
        <thead className="border-b border-gray-200 text-xs text-gray-500">
          <tr>
            <th scope="col" className="px-3 py-2">Email</th><th scope="col" className="px-3 py-2">Role</th><th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Forms</th><th scope="col" className="px-3 py-2">Responses</th><th scope="col" className="px-3 py-2">Joined</th>
            <th scope="col" className="px-3 py-2">Last login</th><th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-gray-100 last:border-0">
              <td className="px-3 py-2 font-medium">{u.email}{u.id === selfId && <span className="ml-1 text-xs text-gray-400">(you)</span>}</td>
              <td className="px-3 py-2 capitalize">{u.role}</td>
              <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.suspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{u.suspended ? "Suspended" : "Active"}</span></td>
              <td className="px-3 py-2 tabular-nums">{u.forms}</td>
              <td className="px-3 py-2 tabular-nums">{u.responses}</td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "never"}</td>
              <td className="px-3 py-2 text-right">
                {u.role !== "admin" && (
                  <button onClick={() => toggle(u)} disabled={busy === u.id} className={`btn !px-3 !py-1 !text-xs ${u.suspended ? "btn-ghost" : "btn-danger"}`} aria-label={`${u.suspended ? "Reactivate" : "Suspend"} ${u.email}`}>
                    {busy === u.id ? "…" : u.suspended ? "Reactivate" : "Suspend"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {node}
    </div>
  );
}
