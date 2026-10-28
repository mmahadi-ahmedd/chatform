import { describe, expect, it } from "vitest";
import { isSafePattern, isValidDate, validateAnswer } from "@/lib/validate";

const q = (over: object) => ({ type: "text" as const, required: true, options: [], config: {}, ...over });

describe("validateAnswer", () => {
  it("enforces required vs optional", () => {
    expect(validateAnswer(q({}), "  ")).toMatch(/required/);
    expect(validateAnswer(q({ required: false }), "")).toBeNull();
  });
  it("validates email", () => {
    expect(validateAnswer(q({ type: "email" }), "a@b.co")).toBeNull();
    expect(validateAnswer(q({ type: "email" }), "nope")).toMatch(/valid email/);
  });
  it("validates choice, dropdown and yes/no against allowed values", () => {
    for (const type of ["choice", "dropdown"] as const) {
      expect(validateAnswer(q({ type, options: ["A", "B"] }), "A")).toBeNull();
      expect(validateAnswer(q({ type, options: ["A", "B"] }), "C")).toMatch(/options/);
    }
    expect(validateAnswer(q({ type: "yesno" }), "Yes")).toBeNull();
    expect(validateAnswer(q({ type: "yesno" }), "Maybe")).toMatch(/Yes or No/);
  });
  it("validates rating range and integers", () => {
    const r = q({ type: "rating", config: { max: 5 } });
    expect(validateAnswer(r, "5")).toBeNull();
    expect(validateAnswer(r, "6")).toMatch(/1 to 5/);
    expect(validateAnswer(r, "0")).toMatch(/1 to 5/);
    expect(validateAnswer(r, "2.5")).toMatch(/1 to 5/);
    expect(validateAnswer(q({ type: "rating", config: { max: 10 } }), "10")).toBeNull();
  });
  it("validates dates including min/max and impossible days", () => {
    const d = q({ type: "date", config: { min_date: "2026-01-01", max_date: "2026-12-31" } });
    expect(validateAnswer(d, "2026-06-15")).toBeNull();
    expect(validateAnswer(d, "2025-12-31")).toMatch(/on or after/);
    expect(validateAnswer(d, "2027-01-01")).toMatch(/on or before/);
    expect(validateAnswer(d, "2026-02-30")).toMatch(/valid date/);
    expect(validateAnswer(d, "tomorrow")).toMatch(/valid date/);
  });
  it("applies text length and pattern rules", () => {
    const t = q({ config: { min_length: 3, max_length: 5, pattern: "^[a-z]+$", pattern_message: "letters only" } });
    expect(validateAnswer(t, "abcd")).toBeNull();
    expect(validateAnswer(t, "ab")).toMatch(/at least 3/);
    expect(validateAnswer(t, "abcdef")).toMatch(/under 5/);
    expect(validateAnswer(t, "ab1d")).toBe("letters only");
  });
  it("requires a file id for file questions", () => {
    expect(validateAnswer(q({ type: "file" }), "not-a-uuid")).toMatch(/upload/);
    expect(validateAnswer(q({ type: "file" }), "0c3f2a9e-6f0e-4b53-9d1a-0f2a1c3b4d5e")).toBeNull();
  });
  it("rejects absurdly long answers", () => {
    expect(validateAnswer(q({}), "x".repeat(2001))).toMatch(/too long/);
  });
});

describe("helpers", () => {
  it("isValidDate", () => {
    expect(isValidDate("2024-02-29")).toBe(true);
    expect(isValidDate("2025-02-29")).toBe(false);
    expect(isValidDate("2025-13-01")).toBe(false);
  });
  it("isSafePattern rejects catastrophic or broken patterns", () => {
    expect(isSafePattern("^[0-9]{10}$")).toBe(true);
    expect(isSafePattern("(a+)+$")).toBe(false);
    expect(isSafePattern("(.*)*x")).toBe(false);
    expect(isSafePattern("[unclosed")).toBe(false);
    expect(isSafePattern("a".repeat(101))).toBe(false);
  });
});
