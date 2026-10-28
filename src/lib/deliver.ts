import { query } from "./db";
import { decrypt, hmacHex } from "./crypto";
import { logError } from "./logger";
import { sendMail, type SendResult } from "./mail";
import { assertSafeWebhookUrl } from "./safeurl";
import type { AnswerItem } from "./types";

type Kind = "email" | "webhook";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const appUrl = () => process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");

interface Ctx {
  form: { id: string; title: string; slug: string; notify_enabled: boolean; notify_email: string; webhook_url: string; webhook_secret_enc: string; owner_email: string };
  response: { id: string; submitted_at: string; answers: AnswerItem[] };
}

async function load(formId: string, responseId: string): Promise<Ctx | null> {
  const f = await query(
    `select f.id, f.title, f.slug, f.notify_enabled, f.notify_email, f.webhook_url, f.webhook_secret_enc, u.email as owner_email
     from forms f join users u on u.id = f.user_id where f.id = $1`,
    [formId]
  );
  const r = await query("select id, submitted_at, answers from responses where id = $1 and form_id = $2", [responseId, formId]);
  return f[0] && r[0] ? { form: f[0], response: r[0] } : null;
}

function emailText(c: Ctx) {
  const lines = c.response.answers.map((a) => `${a.label}\n  ${a.value || "(skipped)"}`);
  const link = appUrl() ? `\n\nView all responses: ${appUrl()}/dashboard/forms/${c.form.id}?tab=responses` : "";
  return `You got a new response on "${c.form.title}".\nSubmitted: ${new Date(c.response.submitted_at).toISOString()}\n\n${lines.join("\n\n")}${link}\n`;
}

async function attemptEmail(c: Ctx): Promise<SendResult> {
  const to = c.form.notify_email || c.form.owner_email;
  return sendMail(to, `New response: ${c.form.title}`.slice(0, 150), emailText(c));
}

async function attemptWebhook(c: Ctx, deliveryId: string): Promise<SendResult> {
  let url: URL;
  try {
    url = await assertSafeWebhookUrl(c.form.webhook_url);
  } catch (e: any) {
    return { status: "failed", error: e.message };
  }
  const secret = decrypt(c.form.webhook_secret_enc) ?? "";
  const body = JSON.stringify({
    event: "response.created",
    form: { id: c.form.id, title: c.form.title, slug: c.form.slug },
    response: { id: c.response.id, submitted_at: c.response.submitted_at, answers: c.response.answers },
  });
  let last: SendResult = { status: "failed", error: "Unknown error" };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ts = Math.floor(Date.now() / 1000).toString();
    try {
      const res = await fetch(url, {
        method: "POST",
        redirect: "manual", // never follow redirects (they could point at internal addresses)
        signal: AbortSignal.timeout(5000),
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ChatForm-Webhook/1.0",
          "X-ChatForm-Event": "response.created",
          "X-ChatForm-Delivery": deliveryId,
          "X-ChatForm-Timestamp": ts,
          "X-ChatForm-Signature": `sha256=${hmacHex(secret, `${ts}.${body}`)}`,
        },
        body,
      });
      if (res.status >= 200 && res.status < 300) return { status: "success", code: res.status, attempts: attempt };
      last = { status: "failed", code: res.status, attempts: attempt, error: res.status >= 300 && res.status < 400 ? "Endpoint answered with a redirect (not followed)." : `Endpoint answered with HTTP ${res.status}.` };
      if (res.status < 500 && res.status !== 429) return last; // client errors won't fix themselves
    } catch (e: any) {
      last = { status: "failed", attempts: attempt, error: `Request failed: ${e?.name === "TimeoutError" ? "timed out after 5s" : e?.message ?? "network error"}`.slice(0, 300) };
    }
    if (attempt < 2) await sleep(400);
  }
  return last;
}

async function record(kind: Kind, c: Ctx, r: SendResult, existingId?: string) {
  if (existingId) {
    await query("update deliveries set status=$1, status_code=$2, error=$3, attempts=attempts+$5, updated_at=now() where id=$4", [r.status, r.code ?? null, r.error ?? null, existingId, r.attempts ?? 1]);
  } else {
    await query("insert into deliveries (form_id, response_id, kind, status, status_code, error) values ($1,$2,$3,$4,$5,$6)", [
      c.form.id, c.response.id, kind, r.status, r.code ?? null, r.error ?? null,
    ]);
  }
}

/** Run all configured notifications for a new response. Never throws; every outcome lands in the delivery log. */
export async function deliverResponse(formId: string, responseId: string) {
  try {
    const c = await load(formId, responseId);
    if (!c) return;
    const jobs: Promise<void>[] = [];
    if (c.form.notify_enabled) jobs.push(attemptEmail(c).then((r) => record("email", c, r)));
    if (c.form.webhook_url) {
      const id = (await query<{ id: string }>("select gen_random_uuid() as id"))[0].id;
      jobs.push(
        attemptWebhook(c, id).then((r) =>
          query("insert into deliveries (id, form_id, response_id, kind, status, status_code, error, attempts) values ($1,$2,$3,'webhook',$4,$5,$6,$7)", [id, c.form.id, c.response.id, r.status, r.code ?? null, r.error ?? null, r.attempts ?? 1]).then(() => {})
        )
      );
    }
    await Promise.allSettled(jobs);
  } catch (e) {
    await logError("deliver", e);
  }
}

/** Retry a single logged delivery (used by the "Retry" button). */
export async function retryDelivery(formId: string, deliveryId: string): Promise<SendResult | null> {
  const rows = await query("select id, kind, response_id from deliveries where id = $1 and form_id = $2", [deliveryId, formId]);
  const d = rows[0];
  if (!d || !d.response_id) return null;
  const c = await load(formId, d.response_id);
  if (!c) return null;
  const result = d.kind === "email" ? await attemptEmail(c) : await attemptWebhook(c, d.id);
  await record(d.kind, c, result, d.id);
  return result;
}
