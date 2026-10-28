import { retryDelivery } from "@/lib/deliver";
import { guardForm } from "@/lib/guard";
import { err, json, route, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { isUuid } from "@/lib/validate";

export const POST = route<{ params: { id: string; did: string } }>("deliveries.retry", async (_req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  if (!isUuid(params.did)) return err("Not found", 404);
  const rl = await rateLimit(`retry:${g.user.id}`, 30, 600);
  if (!rl.ok) return tooMany(rl.retryAfter, "retries");
  const result = await retryDelivery(params.id, params.did);
  return result ? json(result) : err("Not found", 404);
});
