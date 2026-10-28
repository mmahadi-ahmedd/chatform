import { query } from "./db";

/** Best-effort: logging must never break the request. */
export async function logActivity(userId: string | null, action: string, detail: Record<string, unknown> = {}) {
  try {
    await query("insert into activity_log (user_id, action, detail) values ($1, $2, $3)", [userId, action, JSON.stringify(detail)]);
  } catch {
    /* ignore */
  }
}

export async function logError(source: string, error: unknown) {
  const e = error instanceof Error ? error : new Error(String(error));
  console.error(`[${source}]`, e);
  try {
    await query("insert into error_log (source, message, stack) values ($1, $2, $3)", [
      source.slice(0, 100),
      e.message.slice(0, 500),
      (e.stack ?? "").slice(0, 2000),
    ]);
  } catch {
    /* ignore */
  }
}
