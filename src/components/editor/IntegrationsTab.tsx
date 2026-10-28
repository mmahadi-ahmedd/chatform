"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { EmptyState, ErrorState, Skeleton } from "../Toasts";
import { CopyRow } from "./ShareTab";

interface Settings {
  notify_enabled: boolean;
  notify_email: string;
  webhook_url: string;
  has_secret: boolean;
  owner_email: string;
  email_configured: boolean;
}
interface Delivery {
  id: string; kind: "email" | "webhook"; status: "success" | "failed" | "skipped";
  attempts: number; status_code: number | null; error: string | null; created_at: string; updated_at: string;
}

const badge: Record<string, string> = { success: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700", skipped: "bg-gray-100 text-gray-600" };

export default function IntegrationsTab({ formId, push }: { formId: string; push: (k: "success" | "error", t: string) => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadDeliveries = useCallback(async () => {
    const r = await api<Delivery[]>(`/api/forms/${formId}/deliveries`);
    if (r.ok) setDeliveries(r.data);
  }, [formId]);

  const load = useCallback(async () => {
    const r = await api<Settings>(`/api/forms/${formId}/integrations`);
    if (r.ok) setS(r.data);
    else setError(r.error!);
    loadDeliveries();
  }, [formId, loadDeliveries]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!s) return;
    setSaving(true);
    const r = await api<Settings & { secret?: string }>(`/api/forms/${formId}/integrations`, {
      method: "PUT",
      json: { notify_enabled: s.notify_enabled, notify_email: s.notify_email, webhook_url: s.webhook_url },
    });
    setSaving(false);
    if (r.ok) {
      const { secret: sec, ...rest } = r.data;
      setS(rest);
      if (sec) setSecret(sec);
      if (!rest.webhook_url) setSecret(null);
      push("success", "Integration settings saved");
    } else push("error", r.error!);
  }

  async function regenerate() {
    if (!confirm("Generate a new signing secret? The old one stops working immediately.")) return;
    const r = await api<{ secret: string }>(`/api/forms/${formId}/integrations`, { method: "POST" });
    if (r.ok) { setSecret(r.data.secret); push("success", "New secret generated"); } else push("error", r.error!);
  }

  async function retry(id: string) {
    setRetrying(id);
    const r = await api<{ status: string }>(`/api/forms/${formId}/deliveries/${id}/retry`, { method: "POST" });
    setRetrying(null);
    if (r.ok) push(r.data.status === "success" ? "success" : "error", r.data.status === "success" ? "Delivered" : "Delivery failed again");
    else push("error", r.error!);
    loadDeliveries();
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!s) return <Skeleton rows={2} />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card space-y-3 p-4" aria-labelledby="email-h">
        <h2 id="email-h" className="font-semibold">Email notifications</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={s.notify_enabled} onChange={(e) => set("notify_enabled", e.target.checked)} />
          Email me when a new response arrives
        </label>
        <label className="block text-sm">
          Send to
          <input type="email" className="input mt-1" placeholder={s.owner_email} value={s.notify_email} onChange={(e) => set("notify_email", e.target.value)} />
          <span className="text-xs text-gray-500">Leave empty to use your account email ({s.owner_email}).</span>
        </label>
        {!s.email_configured && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Email sending isn&apos;t set up on this server yet (the server needs a <code>RESEND_API_KEY</code>). Notifications will be logged as &ldquo;skipped&rdquo; until it is.</p>}
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="hook-h">
        <h2 id="hook-h" className="font-semibold">Webhook</h2>
        <p className="text-sm text-gray-600">We&apos;ll POST each new response as JSON to your URL, signed so you can verify it came from ChatForm.</p>
        <label className="block text-sm">
          Endpoint URL
          <input type="url" className="input mt-1" placeholder="https://example.com/hooks/chatform" value={s.webhook_url} onChange={(e) => set("webhook_url", e.target.value)} />
        </label>
        {secret && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" role="status">
            <p className="font-medium">Your signing secret. Copy it now, it won&apos;t be shown again.</p>
            <div className="mt-2"><CopyRow text={secret} /></div>
          </div>
        )}
        {s.webhook_url && s.has_secret && !secret && (
          <p className="text-xs text-gray-500">🔒 Signing secret is stored encrypted. <button onClick={regenerate} className="text-indigo-600 underline">Regenerate</button></p>
        )}
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-medium">How to verify the signature</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-gray-100">{`// Node.js
const expected = "sha256=" + crypto
  .createHmac("sha256", SECRET)
  .update(req.headers["x-chatform-timestamp"] + "." + rawBody)
  .digest("hex");
// compare with req.headers["x-chatform-signature"]`}</pre>
        </details>
      </section>

      <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Save integrations"}</button>

      <section aria-labelledby="del-h">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="del-h" className="font-semibold">Delivery log</h2>
          <button onClick={loadDeliveries} className="btn btn-ghost">↻ Refresh</button>
        </div>
        {deliveries === null ? <Skeleton rows={2} /> : deliveries.length === 0 ? (
          <EmptyState icon="📬" title="No deliveries yet">Each new response shows up here with its email and webhook status.</EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-xs text-gray-500">
                <tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">When</th><th className="px-3 py-2">Details</th><th className="px-3 py-2"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 capitalize">{d.kind}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[d.status]}`}>{d.status}</span></td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">{new Date(d.updated_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{d.status_code ? `HTTP ${d.status_code}. ` : ""}{d.error ?? ""}{d.attempts > 1 ? ` (${d.attempts} attempts)` : ""}</td>
                    <td className="px-3 py-2 text-right">
                      {d.status !== "success" && <button onClick={() => retry(d.id)} disabled={retrying === d.id} className="btn btn-ghost !px-2 !py-1 !text-xs">{retrying === d.id ? "Retrying…" : "Retry"}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
