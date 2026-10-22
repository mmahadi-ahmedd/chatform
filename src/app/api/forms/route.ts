import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { newSlug } from "@/lib/forms";
import { json, err } from "@/lib/http";

export async function GET() {
  const user = await getUser();
  if (!user) return err("Unauthorized", 401);
  const rows = await query(
    `select f.id, f.title, f.slug, f.published, f.created_at,
       (select count(*)::int from responses r where r.form_id = f.id) as response_count
     from forms f where f.user_id = $1 order by f.created_at desc`,
    [user.id]
  );
  return json(rows);
}

export async function POST() {
  const user = await getUser();
  if (!user) return err("Unauthorized", 401);
  const [form] = await query("insert into forms (user_id, title, slug) values ($1, 'Untitled form', $2) returning id", [
    user.id,
    newSlug(),
  ]);
  await query(
    "insert into questions (form_id, position, type, label, required) values ($1, 0, 'text', 'What is your name?', true)",
    [form.id]
  );
  return json({ id: form.id }, 201);
}
