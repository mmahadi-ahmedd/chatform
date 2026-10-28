import { requireAdminPage } from "@/lib/adminGuard";
import { platformStats } from "@/lib/admin";
import AdminShell from "@/components/AdminShell";
import { DailyChart } from "@/components/Charts";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const admin = await requireAdminPage();
  const s = await platformStats();
  const cards: [string, number, string][] = [
    ["Users", s.users, `${s.new_users_7d} new in the last 7 days`],
    ["Suspended accounts", s.suspended, `${s.admins} administrator${s.admins === 1 ? "" : "s"}`],
    ["Forms", s.forms, `${s.published_forms} published`],
    ["Responses", s.responses, `${s.responses_7d} in the last 7 days`],
    ["Failed deliveries (7d)", s.failed_deliveries_7d, "Email or webhook errors"],
    ["Server errors (24h)", s.errors_24h, "See Activity & errors"],
  ];
  return (
    <AdminShell active="overview" email={admin.email}>
      <h1 className="text-2xl font-bold">Platform overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="card p-5">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
            <div className="text-xs text-gray-400">{hint}</div>
          </div>
        ))}
      </div>
      <section className="card mt-6 p-4" aria-labelledby="g">
        <h2 id="g" className="mb-2 font-semibold">Last 14 days</h2>
        <DailyChart data={s.daily} labels={["New users", "New forms", "Responses"]} />
      </section>
    </AdminShell>
  );
}
