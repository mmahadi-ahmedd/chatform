import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { json, err } from "@/lib/http";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return err("Unauthorized", 401);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return err("Not found", 404);
  const owns = await query("select 1 from forms where id=$1 and user_id=$2", [params.id, user.id]);
  if (!owns.length) return err("Not found", 404);
  const rows = await query("select id, answers, submitted_at from responses where form_id=$1 order by submitted_at desc limit 500", [
    params.id,
  ]);
  return json(rows);
}
