import { describe, expect, it } from "vitest";
import { formSchema, isValidAvatar, validateForm } from "@/lib/formschema";
import { TEMPLATES, instantiate } from "@/lib/templates";
import { uuid } from "@/lib/uuid";

const mk = (over: Record<string, unknown> = {}) => ({ id: uuid(), type: "text", label: "Q", required: true, options: [], config: {}, logic: null, ...over });
const check = (questions: any[]) => validateForm(formSchema.shape.questions.parse(questions));

describe("validateForm", () => {
  it("requires choice/dropdown to have 2+ distinct options", () => {
    expect(check([mk({ type: "choice", options: ["A"] })])).toMatch(/at least 2/);
    expect(check([mk({ type: "dropdown", options: ["A", "A"] })])).toMatch(/at least 2/);
    expect(check([mk({ type: "dropdown", options: ["A", "B"] })])).toBeNull();
  });
  it("conditions may only depend on EARLIER questions", () => {
    const a = mk(), b = mk();
    expect(check([a, { ...b, logic: { question_id: a.id, op: "equals", value: "x" } }])).toBeNull();
    expect(check([{ ...a, logic: { question_id: b.id, op: "equals", value: "x" } }, b])).toMatch(/earlier question/);
    expect(check([{ ...a, logic: { question_id: a.id, op: "equals", value: "x" } }])).toMatch(/earlier question/);
  });
  it("checks condition values against the referenced question", () => {
    const yn = mk({ type: "yesno" }), rate = mk({ type: "rating", config: { max: 5 } }), dd = mk({ type: "dropdown", options: ["A", "B"] });
    const dep = (ref: any, op: string, value: string) => check([ref, mk({ logic: { question_id: ref.id, op, value } })]);
    expect(dep(yn, "equals", "Maybe")).toMatch(/Yes or No/);
    expect(dep(yn, "equals", "Yes")).toBeNull();
    expect(dep(dd, "equals", "C")).toMatch(/one of the options/);
    expect(dep(rate, "lte", "9")).toMatch(/valid rating/);
    expect(dep(rate, "lte", "3")).toBeNull();
    expect(dep(yn, "gte", "1")).toMatch(/only work with rating/);
  });
  it("rejects inconsistent validation config", () => {
    expect(check([mk({ config: { min_length: 10, max_length: 5 } })])).toMatch(/minimum length/);
    expect(check([mk({ type: "date", config: { min_date: "2026-05-01", max_date: "2026-01-01" } })])).toMatch(/earliest date/);
    expect(check([mk({ config: { pattern: "(a+)+$" } })])).toMatch(/pattern/);
  });
  it("rejects duplicate ids", () => {
    const a = mk();
    expect(check([a, { ...a }])).toMatch(/duplicate id/);
  });
});

describe("schema + templates", () => {
  it("rejects unknown question types and bad ids", () => {
    expect(formSchema.shape.questions.safeParse([mk({ type: "script" })]).success).toBe(false);
    expect(formSchema.shape.questions.safeParse([mk({ id: "1; drop table" })]).success).toBe(false);
  });
  it("avatar must be a short emoji/text or an https URL", () => {
    expect(isValidAvatar("💬")).toBe(true);
    expect(isValidAvatar("https://example.com/a.png")).toBe(true);
    expect(isValidAvatar("http://example.com/a.png")).toBe(false);
    expect(isValidAvatar("javascript:alert(1)")).toBe(false);
    expect(isValidAvatar("<img src=x onerror=alert(1)>")).toBe(false);
  });
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("template %s produces a valid form", (_id, t) => {
    const parsed = formSchema.safeParse({
      title: t.title, description: "", welcome_message: t.welcome, completion_message: t.completion,
      primary_color: "#2a3fd6", avatar: "💬", position: "right", questions: instantiate(t),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(validateForm(parsed.data.questions)).toBeNull();
  });
});
