import { query } from "@/lib/db";
import { loadForm } from "@/lib/forms";
import { validateAnswer } from "@/lib/validate";
import { json, err } from "@/lib/http";
import type { AnswerItem } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const form = await loadForm("slug", params.slug);
  if (!form || !form.published) return err("This form is not accepting responses.", 404);
  const body = await req.json().catch(() => null);
  const given: Record<string, unknown> = body?.answers && typeof body.answers === "object" ? body.answers : {};

  const answers: AnswerItem[] = [];
  for (const q of form.questions) {
    const v = typeof given[q.id] === "string" ? (given[q.id] as string).trim() : "";
    const problem = validateAnswer(q, v);
    if (problem) return err(`"${q.label}": ${problem}`);
    answers.push({ question_id: q.id, label: q.label, value: v });
  }
  await query("insert into responses (form_id, answers) values ($1, $2)", [form.id, JSON.stringify(answers)]);
  return json({ ok: true }, 201);
}
