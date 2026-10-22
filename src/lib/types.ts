export type QuestionType = "text" | "email" | "choice" | "yesno";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options: string[];
}

export interface FormData {
  id: string;
  title: string;
  description: string;
  slug: string;
  published: boolean;
  welcome_message: string;
  completion_message: string;
  primary_color: string;
  questions: Question[];
}

export interface AnswerItem {
  question_id: string;
  label: string;
  value: string;
}

export const TYPE_LABELS: Record<QuestionType, string> = {
  text: "Text",
  email: "Email",
  choice: "Multiple choice",
  yesno: "Yes / No",
};
