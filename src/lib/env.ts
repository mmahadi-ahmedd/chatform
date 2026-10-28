/** The signing secret. In production a missing/weak secret is a hard error, not a silent default. */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!s || s.length < 32 || s.startsWith("change-me")) {
      throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters in production.");
    }
    return s;
  }
  return s || "insecure-dev-secret-change-me-please-0123456789";
}

export const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
