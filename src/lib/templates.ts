import type { LogicOp, QuestionConfig, QuestionType } from "./types";
import { uuid } from "./uuid";

interface TQ {
  key: string;
  type: QuestionType;
  label: string;
  required?: boolean;
  options?: string[];
  config?: QuestionConfig;
  showIf?: { key: string; op: LogicOp; value: string };
}
export interface Template {
  id: string;
  name: string;
  emoji: string;
  description: string;
  title: string;
  welcome: string;
  completion: string;
  questions: TQ[];
}

export const TEMPLATES: Template[] = [
  {
    id: "contact", name: "Contact us", emoji: "✉️", description: "Name, email and a message.",
    title: "Contact us", welcome: "Hi! 👋 How can we help you today?", completion: "Thanks for reaching out. We'll reply by email soon.",
    questions: [
      { key: "name", type: "text", label: "What's your name?" },
      { key: "email", type: "email", label: "What's your email address?" },
      { key: "topic", type: "dropdown", label: "What is this about?", options: ["Question", "Feedback", "Support", "Something else"] },
      { key: "msg", type: "text", label: "How can we help?", config: { min_length: 10, max_length: 1000 } },
    ],
  },
  {
    id: "feedback", name: "Customer feedback", emoji: "⭐", description: "Rating, with a follow-up only for low scores.",
    title: "Customer feedback", welcome: "Hi! Got 1 minute to tell us how we did?", completion: "Thank you, your feedback helps us improve.",
    questions: [
      { key: "rate", type: "rating", label: "How would you rate your experience?", config: { max: 5 } },
      { key: "bad", type: "text", label: "Sorry to hear that. What went wrong?", showIf: { key: "rate", op: "lte", value: "3" } },
      { key: "good", type: "text", label: "Great! What did you like most?", required: false, showIf: { key: "rate", op: "gte", value: "4" } },
      { key: "email", type: "email", label: "Your email, if you'd like a reply (optional)", required: false },
    ],
  },
  {
    id: "event", name: "Event registration", emoji: "🎟️", description: "Sign-ups with a date and a guest follow-up.",
    title: "Event registration", welcome: "Hi! Let's get you registered. 🎉", completion: "You're in! See you at the event.",
    questions: [
      { key: "name", type: "text", label: "Your full name?" },
      { key: "email", type: "email", label: "Your email address?" },
      { key: "session", type: "dropdown", label: "Which session will you attend?", options: ["Morning", "Afternoon", "Both"] },
      { key: "guest", type: "yesno", label: "Are you bringing a guest?" },
      { key: "gname", type: "text", label: "What's your guest's name?", showIf: { key: "guest", op: "equals", value: "Yes" } },
    ],
  },
  {
    id: "job", name: "Job application", emoji: "💼", description: "Collect details and a CV (PDF).",
    title: "Job application", welcome: "Hi! Thanks for your interest. Let's start your application.", completion: "Application received. We'll be in touch.",
    questions: [
      { key: "name", type: "text", label: "Your full name?" },
      { key: "email", type: "email", label: "Your email address?" },
      { key: "role", type: "choice", label: "Which role are you applying for?", options: ["Frontend", "Backend", "Full-stack"] },
      { key: "start", type: "date", label: "When could you start?", required: false },
      { key: "cv", type: "file", label: "Upload your CV (PDF, max 2 MB)" },
    ],
  },
  {
    id: "newsletter", name: "Newsletter sign-up", emoji: "📰", description: "Just a name and an email.",
    title: "Join our newsletter", welcome: "Hi! Want updates in your inbox?", completion: "You're on the list. Welcome!",
    questions: [
      { key: "name", type: "text", label: "What should we call you?" },
      { key: "email", type: "email", label: "Where should we send it?" },
    ],
  },
];

/** Turn a template's keys into real question ids (logic is re-pointed at them). */
export function instantiate(t: Template) {
  const ids = new Map(t.questions.map((q) => [q.key, uuid()]));
  return t.questions.map((q) => ({
    id: ids.get(q.key)!,
    type: q.type,
    label: q.label,
    required: q.required ?? true,
    options: q.options ?? [],
    config: q.config ?? {},
    logic: q.showIf ? { question_id: ids.get(q.showIf.key)!, op: q.showIf.op, value: q.showIf.value } : null,
  }));
}
