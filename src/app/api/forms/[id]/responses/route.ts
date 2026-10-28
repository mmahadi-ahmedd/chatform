import { query } from "@/lib/db";
import { guardForm } from "@/lib/guard";
import { json, route } from "@/lib/http";

const PAGE = 25;

export const GET = route<{ params: { id: string } }>("responses.list", async (req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const dateOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
  const from = dateOk(sp.get("from"));
  const to = dateOk(sp.get("to"));
  const sort = sp.get("sort") === "oldest" ? "asc" : "desc";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const where = ["r.form_id = $1"];
  const args: unknown[] = [params.id];
  if (from) { args.push(from + "T00:00:00Z"); where.push(`r.submitted_at >= $${args.length}::timestamptz`); }
  if (to) { args.push(to + "T00:00:00Z"); where.push(`r.submitted_at < ($${args.length}::timestamptz + interval '1 day')`); }
  if (q) {
    args.push("%" + q.replace(/[\\%_]/g, "\\$&") + "%");
    where.push(`exists (select 1 from jsonb_array_elements(r.answers) a where a->>'value' ilike $${args.length})`);
  }
  const cond = where.join(" and ");
  const [{ n }] = await query<{ n: number }>(`select count(*)::int as n from responses r where ${cond}`, args);
  const rows = await query(
    `select r.id, r.answers, r.submitted_at from responses r where ${cond} order by r.submitted_at ${sort} limit ${PAGE} offset ${(page - 1) * PAGE}`,
    args
  );
  return json({ rows, total: n, page, pages: Math.max(1, Math.ceil(n / PAGE)) });
});
