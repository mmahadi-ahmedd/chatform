import { z } from "zod";
import { pool, query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { loadForm } from "@/lib/forms";
import { json, err } from "@/lib/http";

const uuid = /^[0-9a-f-]{36}$/i;

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().max(500).default(""),
  welcome_message: z.string().trim().min(1).max(300),
  completion_message: z.string().trim().min(1).max(300),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color"),
  published: z.boolean().optional(),
  questions: z
    .array(
      z.object({
        type: z.enum(["text", "email", "choice", "yesno"]),
        label: z.string().trim().min(1, "Every question needs text").max(300),
        required: z.boolean(),
        options: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
      })
    )
    .max(50),
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return err("Unauthorized", 401);
  if (!uuid.test(params.id)) return err("Not found", 404);
  const form = await loadForm("id", params.id, user.id);
  return form ? json(form) : err("Not found", 404);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return err("Unauthorized", 401);
  if (!uuid.test(params.id)) return err("Not found", 404);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const d = parsed.data;
  for (const q of d.questions) {
    if (q.type === "choice" && q.options.length < 2) return err(`"${q.label}" needs at least 2 options.`);
  }
  if (d.published && d.questions.length === 0) return err("Add at least one question before publishing.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    const upd = await client.query(
      `update forms set title=$1, description=$2, welcome_message=$3, completion_message=$4, primary_color=$5,
         published = coalesce($6, published), updated_at = now()
       where id=$7 and user_id=$8 returning id`,
      [d.title, d.description, d.welcome_message, d.completion_message, d.primary_color, d.published ?? null, params.id, user.id]
    );
    if (!upd.rowCount) {
      await client.query("rollback");
      return err("Not found", 404);
    }
    await client.query("delete from questions where form_id = $1", [params.id]);
    for (let i = 0; i < d.questions.length; i++) {
      const q = d.questions[i];
      await client.query(
        "insert into questions (form_id, position, type, label, required, options) values ($1,$2,$3,$4,$5,$6)",
        [params.id, i, q.type, q.label, q.required, JSON.stringify(q.type === "choice" ? q.options : [])]
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    return err("Could not save the form.", 500);
  } finally {
    client.release();
  }
  return json(await loadForm("id", params.id, user.id));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  // Quick publish / unpublish from the dashboard
  const user = await getUser();
  if (!user) return err("Unauthorized", 401);
  if (!uuid.test(params.id)) return err("Not found", 404);
  const body = await req.json().catch(() => null);
  if (typeof body?.published !== "boolean") return err("published must be true or false");
  if (body.published) {
    const [c] = await query("select count(*)::int as n from questions where form_id = $1", [params.id]);
    if (!c || c.n === 0) return err("Add at least one question before publishing.");
  }
  const rows = await query("update forms set published=$1, updated_at=now() where id=$2 and user_id=$3 returning id", [
    body.published,
    params.id,
    user.id,
  ]);
  return rows.length ? json({ ok: true }) : err("Not found", 404);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return err("Unauthorized", 401);
  if (!uuid.test(params.id)) return err("Not found", 404);
  await query("delete from forms where id=$1 and user_id=$2", [params.id, user.id]);
  return json({ ok: true });
}
