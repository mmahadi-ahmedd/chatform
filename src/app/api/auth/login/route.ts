import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { json, err } from "@/lib/http";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("Enter your email and password.");
  const [user] = await query("select id, password_hash from users where email = $1", [parsed.data.email.toLowerCase()]);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return err("Wrong email or password.", 401);
  await createSession(user.id);
  return json({ ok: true });
}
