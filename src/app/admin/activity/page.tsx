import { query } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import { EmptyState } from "@/components/Toasts";
import { requireAdminPage } from "@/lib/adminGuard";

export const dynamic = "force-dynamic";

export default async function AdminActivity() {
  const admin = await requireAdminPage();
  const activity = await query(
    `select a.id, a.action, a.detail, a.created_at::text as created_at, u.email
     from activity_log a left join users u on u.id = a.user_id order by a.created_at desc limit 100`
  );
  const errors = await query("select id, source, message, created_at::text as created_at from error_log order by created_at desc limit 50");
  const failed = await query(
    `select d.id, d.kind, d.error, d.status_code, d.created_at::text as created_at, f.title
     from deliveries d join forms f on f.id = d.form_id where d.status = 'failed' order by d.created_at desc limit 20`
  );
  return (
    <AdminShell active="activity" email={admin.email}>
      <h1 className="text-2xl font-bold">Activity &amp; errors</h1>

      <section className="mt-6" aria-labelledby="err">
        <h2 id="err" className="mb-2 font-semibold">Recent errors</h2>
        {errors.length === 0 ? <EmptyState icon="✅" title="No errors recorded" /> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-xs text-gray-500"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Message</th></tr></thead>
              <tbody>{errors.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.source}</td>
                  <td className="px-3 py-2">{e.message}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="fd">
        <h2 id="fd" className="mb-2 font-semibold">Failed deliveries</h2>
        {failed.length === 0 ? <EmptyState icon="📬" title="No failed deliveries" /> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-xs text-gray-500"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Form</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Error</th></tr></thead>
              <tbody>{failed.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">{new Date(d.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{d.title}</td>
                  <td className="px-3 py-2 capitalize">{d.kind}</td>
                  <td className="px-3 py-2 text-xs">{d.status_code ? `HTTP ${d.status_code}. ` : ""}{d.error}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="act">
        <h2 id="act" className="mb-2 font-semibold">Platform activity (latest 100)</h2>
        {activity.length === 0 ? <EmptyState icon="🗒️" title="No activity yet" /> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-xs text-gray-500"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Details</th></tr></thead>
              <tbody>{activity.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{a.email ?? <span className="text-gray-400">anonymous</span>}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.action}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-gray-500">{Object.keys(a.detail).length ? JSON.stringify(a.detail) : ""}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
