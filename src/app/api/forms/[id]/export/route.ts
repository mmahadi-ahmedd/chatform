import { query } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { loadOwnedForm } from "@/lib/forms";
import { guardForm } from "@/lib/guard";
import { route } from "@/lib/http";
import type { AnswerItem } from "@/lib/types";
import { logActivity } from "@/lib/logger";

export const GET = route<{ params: { id: string } }>("export", async (req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const form = (await loadOwnedForm(params.id, g.user.id))!;
  const sp = new URL(req.url).searchParams;
  const ok = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
  const from = ok(sp.get("from"));
  const to = ok(sp.get("to"));

  const args: unknown[] = [params.id];
  let cond = "form_id = $1";
  if (from) { args.push(from + "T00:00:00Z"); cond += ` and submitted_at >= $${args.length}::timestamptz`; }
  if (to) { args.push(to + "T00:00:00Z"); cond += ` and submitted_at < ($${args.length}::timestamptz + interval '1 day')`; }
  const rows = await query<{ id: string; answers: AnswerItem[]; submitted_at: string }>(
    `select id, answers, submitted_at from responses where ${cond} order by submitted_at asc limit 10000`,
    args
  );

  // Columns: current questions in order, then any question that only exists in older responses.
  const cols = new Map<string, string>(form.questions.map((q) => [q.id, q.label]));
  for (const r of rows) for (const a of r.answers) if (!cols.has(a.question_id)) cols.set(a.question_id, a.label);
  const ids = [...cols.keys()];
  const table: unknown[][] = [["Submitted at (UTC)", "Response ID", ...ids.map((i) => cols.get(i))]];
  for (const r of rows) {
    const byId = new Map(r.answers.map((a) => [a.question_id, a.value]));
    table.push([new Date(r.submitted_at).toISOString(), r.id, ...ids.map((i) => byId.get(i) ?? "")]);
  }
  await logActivity(g.user.id, "responses.export", { form: params.id, rows: rows.length });
  const name = form.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "responses";
  return new Response(toCsv(table), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-responses.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
