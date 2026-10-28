import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { err, route } from "@/lib/http";
import { safeFilename } from "@/lib/files";
import { isUuid } from "@/lib/validate";

/** Uploaded files are private: only the owner of the form they were sent to can download them. */
export const GET = route<{ params: { uid: string } }>("uploads.get", async (_req, { params }) => {
  const user = await getUser();
  if (!user) return err("Please sign in.", 401);
  if (!isUuid(params.uid)) return err("Not found", 404);
  const rows = await query(
    `select u.filename, u.mime, u.data from uploads u join forms f on f.id = u.form_id where u.id = $1 and f.user_id = $2`,
    [params.uid, user.id]
  );
  if (!rows.length) return err("Not found", 404);
  return new Response(rows[0].data, {
    headers: {
      "Content-Type": rows[0].mime,
      "Content-Disposition": `attachment; filename="${safeFilename(rows[0].filename)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
});
