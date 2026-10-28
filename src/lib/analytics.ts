import { query } from "./db";
import type { Question } from "./types";

export interface Range { from: string; to: string } // yyyy-mm-dd, inclusive, UTC

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Reads ?from=&to= (yyyy-mm-dd). Defaults to the last 30 days; spans are capped at 366 days. */
export function parseRange(sp: URLSearchParams): Range {
  const ok = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  const today = new Date();
  let to = ok(sp.get("to")) ? new Date(sp.get("to") + "T00:00:00Z") : new Date(iso(today) + "T00:00:00Z");
  let from = ok(sp.get("from")) ? new Date(sp.get("from") + "T00:00:00Z") : new Date(to.getTime() - 29 * DAY);
  if (from > to) [from, to] = [to, from];
  if (to.getTime() - from.getTime() > 365 * DAY) from = new Date(to.getTime() - 365 * DAY);
  return { from: iso(from), to: iso(to) };
}

export async function getAnalytics(formId: string, range: Range, questions: Question[]) {
  const daily = await query<{ date: string; views: number; starts: number; completed: number }>(
    `select to_char(d, 'YYYY-MM-DD') as date,
       coalesce((select count(*) from form_events e where e.form_id=$1 and e.type='view'  and e.created_at >= d and e.created_at < d + interval '1 day'),0)::int as views,
       coalesce((select count(*) from form_events e where e.form_id=$1 and e.type='start' and e.created_at >= d and e.created_at < d + interval '1 day'),0)::int as starts,
       coalesce((select count(*) from responses r where r.form_id=$1 and r.submitted_at >= d and r.submitted_at < d + interval '1 day'),0)::int as completed
     from generate_series($2::timestamptz, $3::timestamptz, interval '1 day') d order by d`,
    [formId, range.from + "T00:00:00Z", range.to + "T00:00:00Z"]
  );
  const sum = (k: "views" | "starts" | "completed") => daily.reduce((n, d) => n + d[k], 0);
  const views = sum("views"), starts = sum("starts"), completed = sum("completed");
  const completionRate = starts > 0 ? Math.min(1, completed / starts) : null;

  const rows = await query<{ qid: string; val: string; n: number }>(
    `select a->>'question_id' as qid, a->>'value' as val, count(*)::int as n
     from responses r, jsonb_array_elements(r.answers) a
     where r.form_id=$1 and r.submitted_at >= $2::timestamptz and r.submitted_at < ($3::timestamptz + interval '1 day')
     group by 1, 2`,
    [formId, range.from + "T00:00:00Z", range.to + "T00:00:00Z"]
  );
  const stats = questions.map((q) => {
    const mine = rows.filter((r) => r.qid === q.id);
    const answered = mine.filter((r) => r.val !== "").reduce((n, r) => n + r.n, 0);
    const skipped = mine.filter((r) => r.val === "").reduce((n, r) => n + r.n, 0);
    let distribution: { value: string; count: number }[] = [];
    let average: number | null = null;
    const count = (v: string) => mine.find((r) => r.val === v)?.n ?? 0;
    if (q.type === "choice" || q.type === "dropdown") distribution = q.options.map((o) => ({ value: o, count: count(o) }));
    if (q.type === "yesno") distribution = ["Yes", "No"].map((o) => ({ value: o, count: count(o) }));
    if (q.type === "rating") {
      const max = q.config.max ?? 5;
      distribution = Array.from({ length: max }, (_, i) => ({ value: String(i + 1), count: count(String(i + 1)) }));
      const total = distribution.reduce((n, d) => n + d.count, 0);
      average = total ? distribution.reduce((n, d) => n + Number(d.value) * d.count, 0) / total : null;
    }
    return { id: q.id, label: q.label, type: q.type, answered, skipped, shown: answered + skipped, distribution, average };
  });

  return {
    range,
    totals: {
      views, starts, completed,
      completionRate,
      abandonmentRate: completionRate === null ? null : 1 - completionRate,
      startRate: views > 0 ? Math.min(1, starts / views) : null,
    },
    daily,
    questions: stats,
  };
}
