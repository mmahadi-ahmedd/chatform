import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { adminEmails } from "@/lib/env";
import { json, err, route, parseBody, tooMany } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { logActivity } from "@/lib/logger";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72, "Password must be at most 72 characters."),
});

export const POST = route("auth.signup", async (req) => {
  const rl = await rateLimit(`signup:${clientIp(req)}`, 5, 3600);
  if (!rl.ok) return tooMany(rl.retryAfter, "sign-up attempts");
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const { email, password } = body.data;
  if (password.toLowerCase() === email) return err("Password can't be the same as your email.");
  if ((await query("select 1 from users where email = $1", [email])).length) return err("An account with this email already exists.", 409);
  const hash = await bcrypt.hash(password, 12);
  const role = adminEmails().includes(email) ? "admin" : "user";
  const [user] = await query("insert into users (email, password_hash, role, last_login_at) values ($1, $2, $3, now()) returning id", [email, hash, role]);
  await createSession(user.id);
  await logActivity(user.id, "user.signup", { role });
  return json({ ok: true });
});
