import type { FormData, Logic, LogicOp, QuestionConfig, QuestionType } from "@/lib/types";

export interface EditQ {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  optionsText: string;
  config: QuestionConfig;
  logic: Logic | null;
}

export interface Draft {
  title: string;
  description: string;
  welcome: string;
  completion: string;
  color: string;
  avatar: string;
  position: "left" | "right";
  questions: EditQ[];
}

export const toOptions = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean);
export const hasOptions = (t: QuestionType) => t === "choice" || t === "dropdown";

export function fromForm(f: FormData): Draft {
  return {
    title: f.title,
    description: f.description,
    welcome: f.welcome_message,
    completion: f.completion_message,
    color: f.primary_color,
    avatar: f.avatar,
    position: f.position,
    questions: f.questions.map((q) => ({
      id: q.id, type: q.type, label: q.label, required: q.required,
      optionsText: q.options.join("\n"), config: q.config ?? {}, logic: q.logic ?? null,
    })),
  };
}

/** Body for PUT /api/forms/:id */
export function toPayload(d: Draft, published?: boolean) {
  return {
    title: d.title,
    description: d.description,
    welcome_message: d.welcome,
    completion_message: d.completion,
    primary_color: d.color,
    avatar: d.avatar,
    position: d.position,
    ...(published === undefined ? {} : { published }),
    questions: d.questions.map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label,
      required: q.required,
      options: hasOptions(q.type) ? toOptions(q.optionsText) : [],
      config: cleanConfig(q),
      logic: q.logic,
    })),
  };
}

function cleanConfig(q: EditQ): QuestionConfig {
  const c = q.config;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
  if (q.type === "text") return { min_length: num(c.min_length), max_length: num(c.max_length), pattern: c.pattern?.trim() || undefined, pattern_message: c.pattern?.trim() ? c.pattern_message?.trim() || undefined : undefined };
  if (q.type === "rating") return { max: c.max ?? 5 };
  if (q.type === "date") return { min_date: c.min_date || undefined, max_date: c.max_date || undefined };
  return {};
}

/** A condition may only depend on an EARLIER question. Drops any that no longer do. */
export function normalizeLogic(qs: EditQ[]): { questions: EditQ[]; cleared: string[] } {
  const cleared: string[] = [];
  const questions = qs.map((q, i) => {
    if (q.logic && !qs.slice(0, i).some((x) => x.id === q.logic!.question_id)) {
      cleared.push(q.label || `Question ${i + 1}`);
      return { ...q, logic: null };
    }
    return q;
  });
  return { questions, cleared };
}

export const OPS: Record<"rating" | "other", { op: LogicOp; label: string }[]> = {
  rating: [
    { op: "equals", label: "is" },
    { op: "not_equals", label: "is not" },
    { op: "gte", label: "is at least" },
    { op: "lte", label: "is at most" },
  ],
  other: [
    { op: "equals", label: "is" },
    { op: "not_equals", label: "is not" },
  ],
};

/** Stable string used to detect unsaved changes. */
export const snapshot = (d: Draft) => JSON.stringify(d);
