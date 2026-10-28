import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { err, json, route } from "@/lib/http";
import { isUuid } from "@/lib/validate";

export const DELETE = route<{ params: { pid: string } }>("presets.delete", async (_req, { params }) => {
  const user = await getUser();
  if (!user) return err("Please sign in.", 401);
  if (!isUuid(params.pid)) return err("Not found", 404);
  const rows = await query("delete from design_presets where id = $1 and user_id = $2 returning id", [params.pid, user.id]);
  return rows.length ? json({ ok: true }) : err("Not found", 404);
});
