import type { Logic } from "./types";

/** Does `answer` satisfy the rule? An unanswered reference only satisfies "not_equals". */
export function matches(logic: Logic, answer: string | undefined): boolean {
  const a = (answer ?? "").trim();
  switch (logic.op) {
    case "equals":
      return a === logic.value;
    case "not_equals":
      return a !== logic.value;
    case "gte":
    case "lte": {
      const x = parseFloat(a);
      const y = parseFloat(logic.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      return logic.op === "gte" ? x >= y : x <= y;
    }
    default:
      return false;
  }
}

/**
 * Returns the questions that should be asked, in order, given the answers so far.
 * A question whose referenced question is itself hidden is hidden too.
 */
export function visibleQuestions<T extends { id: string; logic: Logic | null }>(
  questions: T[],
  answers: Record<string, string>
): T[] {
  const shown = new Set<string>();
  const out: T[] = [];
  for (const q of questions) {
    let ok = true;
    if (q.logic) ok = shown.has(q.logic.question_id) && matches(q.logic, answers[q.logic.question_id]);
    if (ok) {
      shown.add(q.id);
      out.push(q);
    }
  }
  return out;
}
