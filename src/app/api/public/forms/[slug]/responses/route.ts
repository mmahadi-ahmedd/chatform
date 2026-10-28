import { z } from "zod";
import { query } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { deliverResponse } from "@/lib/deliver";
import { loadPublicForm } from "@/lib/forms";
import { err, json, parseBody, route, tooMany } from "@/lib/http";
import { visibleQuestions } from "@/lib/logic";
import { ipHash, rateLimit } from "@/lib/ratelimit";
import type { AnswerItem } from "@/lib/types";
import { isUuid, validateAnswer } from "@/lib/validate";

const schema = z.object({
  answers: z.record(z.string().max(64), z.string().max(2000)).refine((a) => Object.keys(a).length <= 60, "Too many answers"),
  website: z.string().max(200).optional(), // honeypot: real people never see or fill this field
});

export const POST = route<{ params: { slug: string } }>("public.submit", async (req, { params }) => {
  const rl = await rateLimit(`submit:${ipHash(req)}:${params.slug}`, 10, 600);
  if (!rl.ok) return tooMany(rl.retryAfter, "submissions");
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (body.data.website) return json({ ok: true }, 201); // bot: pretend it worked, store nothing

  const form = await loadPublicForm(params.slug);
  if (!form) return err("This form is not accepting responses.", 404);

  // Only questions that are visible given the answers count; answers to hidden questions are discarded.
  const given = body.data.answers;
  const shown = visibleQuestions(form.questions, given);
  const answers: AnswerItem[] = [];
  for (const q of shown) {
    const v = (given[q.id] ?? "").trim();
    const problem = validateAnswer(q, v);
    if (problem) return err(`"${q.label}": ${problem}`);
    if (q.type === "file" && v) {
      const f = await query("select filename from uploads where id = $1 and form_id = $2", [v, form.id]);
      if (!f.length) return err(`"${q.label}": Please upload the file again.`);
      answers.push({ question_id: q.id, label: q.label, value: f[0].filename, file_id: v });
    } else {
      answers.push({ question_id: q.id, label: q.label, value: v });
    }
  }

  const hash = ipHash(req);
  const payload = JSON.stringify(answers);
  const dup = await query(
    "select 1 from responses where form_id = $1 and ip_hash = $2 and submitted_at > now() - interval '60 seconds' and answers = $3::jsonb limit 1",
    [form.id, hash, payload]
  );
  if (dup.length) return err("This response was already submitted.", 409);

  const [row] = await query("insert into responses (form_id, answers, ip_hash) values ($1, $2, $3) returning id", [form.id, payload, hash]);
  await deliverResponse(form.id, row.id);
  return json({ ok: true }, 201);
});
