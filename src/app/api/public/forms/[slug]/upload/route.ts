import { query } from "@/lib/db";
import { loadPublicForm } from "@/lib/forms";
import { safeFilename, sniffOk } from "@/lib/files";
import { err, json, route, tooMany } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/types";
import { isUuid } from "@/lib/validate";

export const POST = route<{ params: { slug: string } }>("public.upload", async (req, { params }) => {
  const rl = await rateLimit(`upload:${clientIp(req)}`, 10, 600);
  if (!rl.ok) return tooMany(rl.retryAfter, "uploads");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return err("File is too large (max 2 MB).", 413);

  const form = await loadPublicForm(params.slug);
  if (!form) return err("This form is not available.", 404);
  const data = await req.formData().catch(() => null);
  const file = data?.get("file");
  const qid = data?.get("question_id");
  if (!(file instanceof File) || !isUuid(qid)) return err("Choose a file to upload.");
  const q = form.questions.find((x) => x.id === qid && x.type === "file");
  if (!q) return err("This question doesn't accept files.");
  if (file.size === 0) return err("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) return err("File is too large (max 2 MB).", 413);
  if (!(file.type in ALLOWED_UPLOAD_TYPES)) return err("Unsupported file type. Use PNG, JPG, GIF, WebP, PDF, TXT or CSV.", 415);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffOk(file.type, buf)) return err("That file doesn't look like a valid " + ALLOWED_UPLOAD_TYPES[file.type].toUpperCase() + ".", 415);

  const [{ n }] = await query<{ n: number }>("select count(*)::int as n from uploads where form_id = $1 and created_at > now() - interval '1 hour'", [form.id]);
  if (n >= 200) return err("This form is receiving too many uploads right now. Try again later.", 429);

  const name = safeFilename(file.name);
  const [row] = await query("insert into uploads (form_id, filename, mime, size, data) values ($1,$2,$3,$4,$5) returning id", [form.id, name, file.type, buf.length, buf]);
  return json({ file_id: row.id, name, size: buf.length }, 201);
});
