import { z } from "zod";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { newSlug } from "@/lib/forms";
import { TEMPLATES, instantiate } from "@/lib/templates";
import { uuid } from "@/lib/uuid";
import { json, err, route, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { logActivity } from "@/lib/logger";
import { pool } from "@/lib/db";
import { saveQuestions } from "@/lib/forms";

export const GET = route("forms.list", async () => {
  const user = await getUser();
  if (!user) return err("Please sign in.", 401);
  const rows = await query(
    `select f.id, f.title, f.slug, f.published, f.created_at, f.updated_at,
       (select count(*)::int from responses r where r.form_id = f.id) as response_count
     from forms f where f.user_id = $1 order by f.created_at desc`,
    [user.id]
  );
  return json(rows);
});

const schema = z.object({ template: z.string().max(40).optional() });

/** Create a blank form, or one from a template. */
export const POST = route("forms.create", async (req) => {
  const user = await getUser();
  if (!user) return err("Please sign in.", 401);
  const rl = await rateLimit(`forms:create:${user.id}`, 30, 3600);
  if (!rl.ok) return tooMany(rl.retryAfter, "new forms");
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return err("Invalid request");
  const tpl = parsed.data.template ? TEMPLATES.find((t) => t.id === parsed.data.template) : undefined;
  if (parsed.data.template && !tpl) return err("Unknown template", 404);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const created = await client.query(
      "insert into forms (user_id, title, slug, welcome_message, completion_message) values ($1,$2,$3,$4,$5) returning id",
      [user.id, tpl?.title ?? "Untitled form", newSlug(),
       tpl?.welcome ?? "Hi there! 👋 Got a minute to answer a few quick questions?",
       tpl?.completion ?? "Thanks! Your response has been recorded. 🎉"]
    );
    const id = created.rows[0].id;
    const questions = tpl
      ? instantiate(tpl)
      : [{ id: uuid(), type: "text" as const, label: "What is your name?", required: true, options: [], config: {}, logic: null }];
    await saveQuestions(client, id, questions);
    await client.query("commit");
    await logActivity(user.id, "form.create", { id, template: tpl?.id ?? null });
    return json({ id }, 201);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
});
