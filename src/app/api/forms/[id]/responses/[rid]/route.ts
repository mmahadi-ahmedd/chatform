import { query } from "@/lib/db";
import { guardForm } from "@/lib/guard";
import { err, json, route } from "@/lib/http";
import { isUuid } from "@/lib/validate";
import { logActivity } from "@/lib/logger";

export const DELETE = route<{ params: { id: string; rid: string } }>("responses.delete", async (_req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  if (!isUuid(params.rid)) return err("Not found", 404);
  const rows = await query("delete from responses where id = $1 and form_id = $2 returning answers", [params.rid, params.id]);
  if (!rows.length) return err("Not found", 404);
  const fileIds = (rows[0].answers as { file_id?: string }[]).map((a) => a.file_id).filter((x): x is string => isUuid(x));
  if (fileIds.length) await query("delete from uploads where form_id = $1 and id = any($2::uuid[])", [params.id, fileIds]);
  await logActivity(g.user.id, "response.delete", { form: params.id });
  return json({ ok: true });
});
