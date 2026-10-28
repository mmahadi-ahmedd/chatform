import { z } from "zod";
import { pool, query } from "@/lib/db";
import { loadOwnedForm, saveQuestions, FormError } from "@/lib/forms";
import { formSchema, validateForm } from "@/lib/formschema";
import { guardForm } from "@/lib/guard";
import { err, json, parseBody, route } from "@/lib/http";
import { logActivity } from "@/lib/logger";

type Ctx = { params: { id: string } };

export const GET = route<Ctx>("forms.get", async (_req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  return json(await loadOwnedForm(params.id, g.user.id));
});

export const PUT = route<Ctx>("forms.update", async (req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const body = await parseBody(req, formSchema);
  if ("response" in body) return body.response;
  const d = body.data;
  const problem = validateForm(d.questions);
  if (problem) return err(problem);
  if (d.published && d.questions.length === 0) return err("Add at least one question before publishing.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    const before = await client.query("select published from forms where id = $1", [params.id]);
    await client.query(
      `update forms set title=$1, description=$2, welcome_message=$3, completion_message=$4, primary_color=$5,
         avatar=$6, position=$7, published = coalesce($8, published), updated_at = now()
       where id=$9 and user_id=$10`,
      [d.title, d.description, d.welcome_message, d.completion_message, d.primary_color, d.avatar, d.position, d.published ?? null, params.id, g.user.id]
    );
    await saveQuestions(client, params.id, d.questions);
    await client.query("commit");
    if (d.published !== undefined && d.published !== before.rows[0].published) await logActivity(g.user.id, d.published ? "form.publish" : "form.unpublish", { id: params.id });
  } catch (e) {
    await client.query("rollback");
    if (e instanceof FormError) return err(e.message);
    throw e;
  } finally {
    client.release();
  }
  return json(await loadOwnedForm(params.id, g.user.id));
});

/** Quick publish / unpublish from the dashboard. */
export const PATCH = route<Ctx>("forms.publish", async (req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const body = await parseBody(req, z.object({ published: z.boolean() }));
  if ("response" in body) return body.response;
  if (body.data.published) {
    const [c] = await query("select count(*)::int as n from questions where form_id = $1", [params.id]);
    if (!c || c.n === 0) return err("Add at least one question before publishing.");
  }
  await query("update forms set published=$1, updated_at=now() where id=$2 and user_id=$3", [body.data.published, params.id, g.user.id]);
  await logActivity(g.user.id, body.data.published ? "form.publish" : "form.unpublish", { id: params.id });
  return json({ ok: true });
});

export const DELETE = route<Ctx>("forms.delete", async (_req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  await query("delete from forms where id=$1 and user_id=$2", [params.id, g.user.id]);
  await logActivity(g.user.id, "form.delete", { id: params.id });
  return json({ ok: true });
});
