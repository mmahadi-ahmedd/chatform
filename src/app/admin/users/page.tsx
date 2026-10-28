import Link from "next/link";
import { query } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import UsersTable from "@/components/UsersTable";
import { requireAdminPage } from "@/lib/adminGuard";

export const dynamic = "force-dynamic";
const PAGE = 20;

export default async function AdminUsers({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const admin = await requireAdminPage();
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const like = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
  const [{ n }] = await query<{ n: number }>("select count(*)::int as n from users where email ilike $1", [like]);
  const rows = await query(
    `select u.id, u.email, u.role, u.suspended, u.created_at::text as created_at, u.last_login_at::text as last_login_at,
       (select count(*)::int from forms f where f.user_id = u.id) as forms,
       (select count(*)::int from responses r join forms f on f.id = r.form_id where f.user_id = u.id) as responses
     from users u where u.email ilike $1 order by u.created_at desc limit ${PAGE} offset ${(page - 1) * PAGE}`,
    [like]
  );
  const pages = Math.max(1, Math.ceil(n / PAGE));
  const href = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <AdminShell active="users" email={admin.email}>
      <h1 className="text-2xl font-bold">Users</h1>
      <form method="get" role="search" className="mt-4 flex gap-2">
        <input name="q" defaultValue={q} type="search" placeholder="Search by email…" aria-label="Search users by email" className="input max-w-sm" />
        <button className="btn btn-primary">Search</button>
        {q && <Link href="/admin/users" className="btn btn-ghost">Clear</Link>}
      </form>
      <p className="mt-3 text-sm text-gray-500" aria-live="polite">{n} user{n === 1 ? "" : "s"}{q ? ` matching "${q}"` : ""}</p>
      <UsersTable rows={rows} selfId={admin.id} />
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          {page > 1 ? <Link className="btn btn-ghost" href={href(page - 1)}>← Previous</Link> : <span />}
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn btn-ghost" href={href(page + 1)}>Next →</Link> : <span />}
        </nav>
      )}
    </AdminShell>
  );
}
