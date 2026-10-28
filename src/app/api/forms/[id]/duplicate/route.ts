import { pool } from "@/lib/db";
import { duplicateForm } from "@/lib/forms";
import { guardForm } from "@/lib/guard";
import { err, json, route } from "@/lib/http";
import { logActivity } from "@/lib/logger";

export const POST = route<{ params: { id: string } }>("forms.duplicate", async (_req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const id = await duplicateForm(client, params.id, g.user.id);
    if (!id) {
      await client.query("rollback");
      return err("Not found", 404);
    }
    await client.query("commit");
    await logActivity(g.user.id, "form.duplicate", { from: params.id, id });
    return json({ id }, 201);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
});
