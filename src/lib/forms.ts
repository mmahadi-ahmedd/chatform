import type { PoolClient } from "pg";
import { randomBytes } from "node:crypto";
import { query } from "./db";
import type { FormData } from "./types";
import type { FormInput } from "./formschema";
import { uuid } from "./uuid";

export const newSlug = () => randomBytes(5).toString("hex");

const COLS = `f.id, f.title, f.description, f.slug, f.published, f.welcome_message, f.completion_message,
  f.primary_color, f.avatar, f.position, f.updated_at`;

async function withQuestions(f: any): Promise<FormData> {
  const questions = await query(
    "select id, type, label, required, options, config, logic from questions where form_id = $1 order by position",
    [f.id]
  );
  return { ...f, questions };
}

/** Owner view: only the owner's form, any status. */
export async function loadOwnedForm(id: string, userId: string): Promise<FormData | null> {
  const rows = await query(`select ${COLS} from forms f where f.id = $1 and f.user_id = $2`, [id, userId]);
  return rows[0] ? withQuestions(rows[0]) : null;
}

/** Public view: published forms whose owner is not suspended. */
export async function loadPublicForm(slug: string): Promise<FormData | null> {
  const rows = await query(
    `select ${COLS} from forms f join users u on u.id = f.user_id
     where f.slug = $1 and f.published = true and u.suspended = false`,
    [slug]
  );
  return rows[0] ? withQuestions(rows[0]) : null;
}

export class FormError extends Error {}

/** Upsert by stable question id so conditional logic and analytics keep working across edits. */
export async function saveQuestions(client: PoolClient, formId: string, questions: FormInput["questions"]) {
  const ids = questions.map((q) => q.id);
  const clash = await client.query("select 1 from questions where id = any($1::uuid[]) and form_id <> $2", [ids, formId]);
  if (clash.rowCount) throw new FormError("Invalid question id.");
  await client.query("delete from questions where form_id = $1 and not (id = any($2::uuid[]))", [formId, ids]);
  for (const [i, q] of questions.entries()) {
    const isOpt = q.type === "choice" || q.type === "dropdown";
    await client.query(
      `insert into questions (id, form_id, position, type, label, required, options, config, logic)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (id) do update set position=excluded.position, type=excluded.type, label=excluded.label,
         required=excluded.required, options=excluded.options, config=excluded.config, logic=excluded.logic
       where questions.form_id = excluded.form_id`,
      [q.id, formId, i, q.type, q.label, q.required, JSON.stringify(isOpt ? q.options : []), JSON.stringify(cleanConfig(q)), q.logic ? JSON.stringify(q.logic) : null]
    );
  }
}

/** Keep only the config keys that make sense for the question type. */
function cleanConfig(q: FormInput["questions"][number]) {
  const c = q.config;
  if (q.type === "text") return { min_length: c.min_length, max_length: c.max_length, pattern: c.pattern || undefined, pattern_message: c.pattern ? c.pattern_message : undefined };
  if (q.type === "rating") return { max: c.max ?? 5 };
  if (q.type === "date") return { min_date: c.min_date, max_date: c.max_date };
  return {};
}

/** Copy a form (design + questions, with logic re-pointed at the new question ids). Always starts as a draft. */
export async function duplicateForm(client: PoolClient, formId: string, userId: string): Promise<string | null> {
  const src = await client.query("select * from forms where id = $1 and user_id = $2", [formId, userId]);
  if (!src.rowCount) return null;
  const f = src.rows[0];
  const created = await client.query(
    `insert into forms (user_id, title, description, slug, published, welcome_message, completion_message, primary_color, avatar, position)
     values ($1,$2,$3,$4,false,$5,$6,$7,$8,$9) returning id`,
    [userId, `${f.title} (copy)`.slice(0, 150), f.description, newSlug(), f.welcome_message, f.completion_message, f.primary_color, f.avatar, f.position]
  );
  const newId = created.rows[0].id;
  const qs = (await client.query("select * from questions where form_id = $1 order by position", [formId])).rows;
  const map = new Map<string, string>(qs.map((q: any) => [q.id, uuid()]));
  for (const q of qs) {
    const logic = q.logic ? { ...q.logic, question_id: map.get(q.logic.question_id) } : null;
    await client.query(
      `insert into questions (id, form_id, position, type, label, required, options, config, logic) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [map.get(q.id), newId, q.position, q.type, q.label, q.required, JSON.stringify(q.options), JSON.stringify(q.config), logic ? JSON.stringify(logic) : null]
    );
  }
  return newId;
}

export async function ownsForm(id: string, userId: string): Promise<boolean> {
  return (await query("select 1 from forms where id = $1 and user_id = $2", [id, userId])).length > 0;
}
