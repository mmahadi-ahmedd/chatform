import { z } from "zod";
import { query } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { err, json, parseBody, route } from "@/lib/http";
import { logActivity } from "@/lib/logger";
import { isUuid } from "@/lib/validate";

/** Suspend or reactivate an account. Admin-only; admins can't suspend themselves or other admins. */
export const PATCH = route<{ params: { uid: string } }>("admin.user", async (req, { params }) => {
  const admin = await getAdmin();
  if (!admin) return err("Forbidden", 403);
  if (!isUuid(params.uid)) return err("Not found", 404);
  const body = await parseBody(req, z.object({ suspended: z.boolean() }));
  if ("response" in body) return body.response;
  if (params.uid === admin.id) return err("You can't suspend your own account.");
  const [target] = await query("select id, email, role from users where id = $1", [params.uid]);
  if (!target) return err("Not found", 404);
  if (target.role === "admin") return err("Administrator accounts can't be suspended here.");
  await query("update users set suspended = $1 where id = $2", [body.data.suspended, params.uid]);
  await logActivity(admin.id, body.data.suspended ? "admin.suspend_user" : "admin.reactivate_user", { target: target.email });
  return json({ ok: true });
});
