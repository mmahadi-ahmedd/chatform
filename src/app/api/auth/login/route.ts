import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { adminEmails } from "@/lib/env";
import { json, err, route, parseBody, tooMany } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { logActivity } from "@/lib/logger";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
let dummy: string | null = null;
const dummyHash = () => (dummy ??= bcrypt.hashSync("not-a-real-password", 12));

export const POST = route("auth.login", async (req) => {
  const body = await parseBody(req, schema);
  if ("response" in body) return err("Enter your email and password.");
  const { email, password } = body.data;
  const ip = await rateLimit(`login:ip:${clientIp(req)}`, 20, 900);
  const acct = await rateLimit(`login:acct:${email}`, 8, 900);
  if (!ip.ok || !acct.ok) return tooMany(Math.max(ip.retryAfter, acct.retryAfter), "login attempts");

  const [user] = await query("select id, password_hash, suspended, role from users where email = $1", [email]);
  const valid = await bcrypt.compare(password, user?.password_hash ?? dummyHash());
  if (!user || !valid) {
    await logActivity(user?.id ?? null, "auth.login_failed", { email });
    return err("Wrong email or password.", 401);
  }
  if (user.suspended) return err("This account has been suspended. Please contact support.", 403);
  if (adminEmails().includes(email) && user.role !== "admin") await query("update users set role = 'admin' where id = $1", [user.id]);
  await query("update users set last_login_at = now() where id = $1", [user.id]);
  await createSession(user.id);
  await logActivity(user.id, "auth.login");
  return json({ ok: true });
});
