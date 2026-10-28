import { query } from "./db";
import { logError } from "./logger";
import { sha256 } from "./crypto";
import { authSecret } from "./env";

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** One-way hash so we can spot repeat submitters without storing IP addresses. */
export const ipHash = (req: Request) => sha256(`${clientIp(req)}|${authSecret()}`).slice(0, 32);

/**
 * Fixed-window counter stored in Postgres (works across serverless instances).
 * Fails open if the database is unavailable so a limiter outage doesn't take the app down.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSec) * windowSec;
  const expires = windowStart + windowSec;
  try {
    const rows = await query<{ count: number }>(
      `insert into rate_limits (key, window_start, count, expires_at) values ($1, $2, 1, $3)
       on conflict (key, window_start) do update set count = rate_limits.count + 1
       returning count`,
      [key, windowStart, expires]
    );
    if (Math.random() < 0.02) query("delete from rate_limits where expires_at < $1", [now]).catch(() => {});
    return rows[0].count > limit ? { ok: false, retryAfter: Math.max(1, expires - now) } : { ok: true, retryAfter: 0 };
  } catch (e) {
    await logError("ratelimit", e);
    return { ok: true, retryAfter: 0 };
  }
}
