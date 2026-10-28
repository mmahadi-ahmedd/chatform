import { z } from "zod";
import { isSafePattern, isUuid, isValidDate } from "./validate";
import type { Logic, QuestionType } from "./types";

const types = ["text", "email", "choice", "dropdown", "yesno", "rating", "date", "file"] as const;
const uuid = z.string().refine(isUuid, "Invalid id");

/** Emoji / short text, or an https image URL. */
export const isValidAvatar = (v: string) =>
  /^https:\/\/[^\s<>"']{3,290}$/.test(v) || ([...v].length <= 6 && !/[<>"'\s]{2,}/.test(v) && !/^https?:/i.test(v));

export const questionSchema = z.object({
  id: uuid,
  type: z.enum(types),
  label: z.string().trim().min(1, "Every question needs text").max(300),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  config: z
    .object({
      min_length: z.number().int().min(0).max(2000).optional(),
      max_length: z.number().int().min(1).max(2000).optional(),
      pattern: z.string().max(100).optional(),
      pattern_message: z.string().max(120).optional(),
      max: z.number().int().min(3).max(10).optional(),
      min_date: z.string().refine(isValidDate, "Invalid date").optional(),
      max_date: z.string().refine(isValidDate, "Invalid date").optional(),
    })
    .default({}),
  logic: z
    .object({
      question_id: uuid,
      op: z.enum(["equals", "not_equals", "gte", "lte"]),
      value: z.string().trim().min(1).max(100),
    })
    .nullable()
    .default(null),
});

export const designSchema = {
  welcome_message: z.string().trim().min(1, "Welcome message is required").max(300),
  completion_message: z.string().trim().min(1, "Success message is required").max(300),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color"),
  avatar: z.string().trim().min(1).max(300).refine(isValidAvatar, "Avatar must be an emoji or an https image URL"),
  position: z.enum(["left", "right"]),
};

export const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().max(500).default(""),
  ...designSchema,
  published: z.boolean().optional(),
  questions: z.array(questionSchema).max(50, "A form can have at most 50 questions"),
});
export type FormInput = z.infer<typeof formSchema>;
type Q = FormInput["questions"][number];

/** Cross-field rules that zod can't express. Returns a user-facing message or null. */
export function validateForm(questions: Q[]): string | null {
  const seen = new Set<string>();
  for (const [i, q] of questions.entries()) {
    const n = `Question ${i + 1}`;
    if (seen.has(q.id)) return `${n} has a duplicate id.`;
    if ((q.type === "choice" || q.type === "dropdown") && (q.options.length < 2 || new Set(q.options).size !== q.options.length))
      return `${n} needs at least 2 different options.`;
    const c = q.config;
    if (c.min_length && c.max_length && c.min_length > c.max_length) return `${n}: minimum length is larger than maximum length.`;
    if (c.min_date && c.max_date && c.min_date > c.max_date) return `${n}: earliest date is after latest date.`;
    if (c.pattern && !isSafePattern(c.pattern)) return `${n}: that pattern is invalid or too complex.`;
    if (q.logic) {
      const ref = questions.slice(0, i).find((x) => x.id === q.logic!.question_id);
      if (!ref) return `${n}: a condition can only depend on an earlier question.`;
      const err = validateLogicValue(q.logic, ref);
      if (err) return `${n}: ${err}`;
    }
    seen.add(q.id);
  }
  return null;
}

function validateLogicValue(l: Logic, ref: { type: QuestionType; options: string[]; config: { max?: number } }): string | null {
  const numeric = l.op === "gte" || l.op === "lte";
  if (numeric && ref.type !== "rating") return "greater/less-than conditions only work with rating questions.";
  if (ref.type === "yesno" && l.value !== "Yes" && l.value !== "No") return "condition value must be Yes or No.";
  if ((ref.type === "choice" || ref.type === "dropdown") && !ref.options.includes(l.value)) return "condition value must be one of the options.";
  if (ref.type === "rating") {
    const n = Number(l.value);
    if (!Number.isInteger(n) || n < 1 || n > (ref.config.max ?? 5)) return "condition value must be a valid rating.";
  }
  return null;
}
