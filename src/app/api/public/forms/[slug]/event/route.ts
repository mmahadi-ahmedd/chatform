import { z } from "zod";
import { query } from "@/lib/db";
import { loadPublicForm } from "@/lib/forms";
import { err, json, parseBody, route, tooMany } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const schema = z.object({ type: z.enum(["view", "start"]), sid: z.string().regex(/^[\w-]{8,64}$/) });

/** Analytics beacon: one "view" and one "start" per chat session (duplicates are ignored). */
export const POST = route<{ params: { slug: string } }>("public.event", async (req, { params }) => {
  const rl = await rateLimit(`event:${clientIp(req)}`, 120, 60);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const form = await loadPublicForm(params.slug);
  if (!form) return err("Not found", 404);
  await query("insert into form_events (form_id, type, sid) values ($1,$2,$3) on conflict do nothing", [form.id, body.data.type, body.data.sid]);
  return json({ ok: true });
});
