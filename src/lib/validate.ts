import type { Question } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export function isValidDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Custom regex patterns are user-supplied, so keep them small and reject the classic
 * catastrophic-backtracking shape (a quantified group that is itself quantified).
 */
export function isSafePattern(p: string): boolean {
  if (p.length > 100) return false;
  if (/(\([^)]*[+*][^)]*\))[+*{]/.test(p)) return false;
  if (/\\[1-9]/.test(p)) return false;
  try {
    new RegExp(p);
    return true;
  } catch {
    return false;
  }
}

type Checkable = Pick<Question, "type" | "required" | "options"> & { config?: Question["config"] };

/** Returns an error message, or null if the value is valid. Used by both browser and server. */
export function validateAnswer(q: Checkable, raw: string): string | null {
  const value = (raw ?? "").trim();
  if (!value) return q.required ? "This question is required." : null;
  if (value.length > 2000) return "Answer is too long (max 2000 characters).";
  const c = q.config ?? {};
  switch (q.type) {
    case "email":
      return EMAIL_RE.test(value) ? null : "Please enter a valid email address.";
    case "yesno":
      return value === "Yes" || value === "No" ? null : "Please choose Yes or No.";
    case "choice":
    case "dropdown":
      return q.options.includes(value) ? null : "Please pick one of the options.";
    case "rating": {
      const max = c.max ?? 5;
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= max ? null : `Please choose a rating from 1 to ${max}.`;
    }
    case "date":
      if (!isValidDate(value)) return "Please enter a valid date.";
      if (c.min_date && value < c.min_date) return `Please choose a date on or after ${c.min_date}.`;
      if (c.max_date && value > c.max_date) return `Please choose a date on or before ${c.max_date}.`;
      return null;
    case "file":
      return isUuid(value) ? null : "Please upload a file.";
    default: {
      if (c.min_length && value.length < c.min_length) return `Please write at least ${c.min_length} characters.`;
      if (c.max_length && value.length > c.max_length) return `Please keep it under ${c.max_length} characters.`;
      if (c.pattern && isSafePattern(c.pattern)) {
        try {
          if (!new RegExp(c.pattern).test(value)) return c.pattern_message || "That answer isn't in the expected format.";
        } catch {
          /* invalid pattern: ignore */
        }
      }
      return null;
    }
  }
}
