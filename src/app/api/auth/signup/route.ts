import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { json, err } from "@/lib/http";

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(8).max(100) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("Enter a valid email and a password of at least 8 characters.");
  const email = parsed.data.email.toLowerCase();
  const exists = await query("select 1 from users where email = $1", [email]);
  if (exists.length) return err("An account with this email already exists.", 409);
  const hash = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await query("insert into users (email, password_hash) values ($1, $2) returning id", [email, hash]);
  await createSession(user.id);
  return json({ ok: true });
}
