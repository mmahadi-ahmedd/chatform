import { destroySession } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  destroySession();
  return json({ ok: true });
}
