import { query } from "@/lib/db";
import { guardForm } from "@/lib/guard";
import { json, route } from "@/lib/http";

export const GET = route<{ params: { id: string } }>("deliveries.list", async (_req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const rows = await query(
    `select id, response_id, kind, status, attempts, status_code, error, created_at, updated_at
     from deliveries where form_id = $1 order by created_at desc limit 50`,
    [params.id]
  );
  return json(rows);
});
