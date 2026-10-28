export interface SendResult {
  status: "success" | "failed" | "skipped";
  code?: number;
  attempts?: number;
  error?: string;
}

/**
 * Sends a plain-text email through the Resend HTTP API.
 * Credentials live only in environment variables (RESEND_API_KEY, MAIL_FROM).
 */
export async function sendMail(to: string, subject: string, text: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "skipped", error: "Email is not configured on this server (RESEND_API_KEY is missing)." };
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "ChatForm <onboarding@resend.dev>", to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { status: "success", code: res.status };
    const body = (await res.text().catch(() => "")).slice(0, 200);
    return { status: "failed", code: res.status, error: `Email provider returned ${res.status}. ${body}`.trim() };
  } catch (e: any) {
    return { status: "failed", error: `Could not reach the email provider: ${e?.name === "TimeoutError" ? "timed out" : e?.message ?? "network error"}`.slice(0, 300) };
  }
}
