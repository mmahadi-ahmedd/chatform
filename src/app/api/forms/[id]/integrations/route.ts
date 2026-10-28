import { z } from "zod";
import { query } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { randomToken } from "@/lib/crypto";
import { guardForm } from "@/lib/guard";
import { err, json, parseBody, route } from "@/lib/http";
import { assertSafeWebhookUrl } from "@/lib/safeurl";
import { logActivity } from "@/lib/logger";

type Ctx = { params: { id: string } };
const newSecret = () => `whsec_${randomToken(24)}`;

async function settings(id: string, ownerEmail: string) {
  const [f] = await query("select notify_enabled, notify_email, webhook_url, (webhook_secret_enc <> '') as has_secret from forms where id = $1", [id]);
  // The signing secret itself is never returned here; it is shown once when created or regenerated.
  return { ...f, owner_email: ownerEmail, email_configured: !!process.env.RESEND_API_KEY };
}

export const GET = route<Ctx>("integrations.get", async (_req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  return json(await settings(params.id, g.user.email));
});

const schema = z.object({
  notify_enabled: z.boolean(),
  notify_email: z.string().trim().max(200).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid notification email."),
  webhook_url: z.string().trim().max(500),
});

export const PUT = route<Ctx>("integrations.update", async (req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const d = body.data;
  let secret: string | undefined;
  if (d.webhook_url) {
    try {
      await assertSafeWebhookUrl(d.webhook_url);
    } catch (e: any) {
      return err(e.message);
    }
    const [cur] = await query("select webhook_secret_enc from forms where id = $1", [params.id]);
    if (!cur.webhook_secret_enc) secret = newSecret();
  }
  await query(
    `update forms set notify_enabled=$1, notify_email=$2, webhook_url=$3,
       webhook_secret_enc = case when $3 = '' then '' when $4::text is not null then $4 else webhook_secret_enc end, updated_at=now()
     where id=$5 and user_id=$6`,
    [d.notify_enabled, d.notify_email, d.webhook_url, secret ? encrypt(secret) : null, params.id, g.user.id]
  );
  await logActivity(g.user.id, "form.integrations", { id: params.id, email: d.notify_enabled, webhook: !!d.webhook_url });
  return json({ ...(await settings(params.id, g.user.email)), secret });
});

/** Regenerate the webhook signing secret. */
export const POST = route<Ctx>("integrations.secret", async (_req, { params }) => {
  const g = await guardForm(params.id);
  if ("response" in g) return g.response;
  const [f] = await query("select webhook_url from forms where id = $1", [params.id]);
  if (!f.webhook_url) return err("Add a webhook URL first.");
  const secret = newSecret();
  await query("update forms set webhook_secret_enc = $1 where id = $2", [encrypt(secret), params.id]);
  await logActivity(g.user.id, "form.webhook_secret_regenerated", { id: params.id });
  return json({ secret });
});
