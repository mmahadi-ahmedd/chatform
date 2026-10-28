import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const forms = await query(
    `select f.id, f.title, f.slug, f.published, f.created_at::text as created_at, f.updated_at::text as updated_at,
       (select count(*)::int from responses r where r.form_id = f.id) as response_count
     from forms f where f.user_id = $1 order by f.created_at desc`,
    [user.id]
  );
  return <Dashboard email={user.email} role={user.role} initialForms={forms} />;
}
