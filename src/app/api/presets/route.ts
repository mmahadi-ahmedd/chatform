import { z } from "zod";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { designSchema } from "@/lib/formschema";
import { err, json, parseBody, route } from "@/lib/http";

export const GET = route("presets.list", async () => {
  const user = await getUser();
  if (!user) return err("Please sign in.", 401);
  return json(await query("select id, name, primary_color, avatar, position, welcome_message, completion_message from design_presets where user_id = $1 order by created_at desc", [user.id]));
});

const schema = z.object({ name: z.string().trim().min(1, "Give the preset a name").max(60), ...designSchema });

export const POST = route("presets.create", async (req) => {
  const user = await getUser();
  if (!user) return err("Please sign in.", 401);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const [{ n }] = await query<{ n: number }>("select count(*)::int as n from design_presets where user_id = $1", [user.id]);
  if (n >= 20) return err("You can save up to 20 design presets. Delete one first.");
  const d = body.data;
  const [row] = await query(
    "insert into design_presets (user_id, name, primary_color, avatar, position, welcome_message, completion_message) values ($1,$2,$3,$4,$5,$6,$7) returning id, name, primary_color, avatar, position, welcome_message, completion_message",
    [user.id, d.name, d.primary_color, d.avatar, d.position, d.welcome_message, d.completion_message]
  );
  return json(row, 201);
});
