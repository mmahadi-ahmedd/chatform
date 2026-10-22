import { query } from "./db";
import type { FormData } from "./types";
import { randomBytes } from "node:crypto";

export function newSlug() {
  return randomBytes(5).toString("hex"); // 10 url-safe chars
}

export async function loadForm(where: "id" | "slug", value: string, userId?: string): Promise<FormData | null> {
  const rows = await query(
    `select id, title, description, slug, published, welcome_message, completion_message, primary_color
     from forms where ${where} = $1 ${userId ? "and user_id = $2" : ""}`,
    userId ? [value, userId] : [value]
  ).catch(() => []);
  const f = rows[0];
  if (!f) return null;
  const questions = await query(
    "select id, type, label, required, options from questions where form_id = $1 order by position",
    [f.id]
  );
  return { ...f, questions };
}
