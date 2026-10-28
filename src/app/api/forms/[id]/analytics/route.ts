import { getAnalytics, parseRange } from "@/lib/analytics";
import { loadOwnedForm } from "@/lib/forms";
import { guardForm } from "@/lib/guard";
import { json, route } from "@/lib/http";

export const GET = route<{ params: { id: string } }>("analytics", async (req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const form = await loadOwnedForm(params.id, g.user.id);
  const range = parseRange(new URL(req.url).searchParams);
  return json(await getAnalytics(params.id, range, form!.questions));
});
