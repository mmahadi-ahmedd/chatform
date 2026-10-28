export type QuestionType = "text" | "email" | "choice" | "dropdown" | "yesno" | "rating" | "date" | "file";

export interface QuestionConfig {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  pattern_message?: string;
  max?: number; // rating scale, 3-10
  min_date?: string; // yyyy-mm-dd
  max_date?: string;
}

export type LogicOp = "equals" | "not_equals" | "gte" | "lte";

/** "Show this question only if <question_id> <op> <value>" */
export interface Logic {
  question_id: string;
  op: LogicOp;
  value: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options: string[];
  config: QuestionConfig;
  logic: Logic | null;
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
  avatar: string;
  position: "left" | "right";
  updated_at?: string;
  questions: Question[];
}

export interface AnswerItem {
  question_id: string;
  label: string;
  value: string;
  file_id?: string;
}

export const TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short text",
  email: "Email",
  choice: "Multiple choice (buttons)",
  dropdown: "Dropdown",
  yesno: "Yes / No",
  rating: "Rating",
  date: "Date",
  file: "File upload",
};

export const OPTION_TYPES: QuestionType[] = ["choice", "dropdown"];
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
};
