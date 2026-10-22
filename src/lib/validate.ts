import type { Question } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Returns an error message, or null if the value is valid. Used by both client and server. */
export function validateAnswer(q: Pick<Question, "type" | "required" | "options">, raw: string): string | null {
  const value = (raw ?? "").trim();
  if (!value) return q.required ? "This question is required." : null;
  if (value.length > 2000) return "Answer is too long (max 2000 characters).";
  switch (q.type) {
    case "email":
      return EMAIL_RE.test(value) ? null : "Please enter a valid email address.";
    case "yesno":
      return value === "Yes" || value === "No" ? null : "Please choose Yes or No.";
    case "choice":
      return q.options.includes(value) ? null : "Please pick one of the options.";
    default:
      return null;
  }
}
