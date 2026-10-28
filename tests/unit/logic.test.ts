import { describe, expect, it } from "vitest";
import { matches, visibleQuestions } from "@/lib/logic";
import type { Logic } from "@/lib/types";

const L = (question_id: string, op: Logic["op"], value: string): Logic => ({ question_id, op, value });
const qs = [
  { id: "a", logic: null },
  { id: "b", logic: L("a", "equals", "Yes") },
  { id: "c", logic: L("b", "equals", "x") }, // depends on a question that may itself be hidden
  { id: "d", logic: L("a", "not_equals", "Yes") },
];
const ids = (answers: Record<string, string>) => visibleQuestions(qs, answers).map((q) => q.id);

describe("conditional logic", () => {
  it("shows a question when its condition is met", () => {
    expect(ids({ a: "Yes" })).toEqual(["a", "b"]);
  });
  it("hides dependents of a hidden question (chain)", () => {
    expect(ids({ a: "No", b: "x" })).toEqual(["a", "d"]); // c hidden because b is hidden, even though b === "x"
    expect(ids({ a: "Yes", b: "x" })).toEqual(["a", "b", "c"]);
  });
  it("not_equals is true when the reference is visible but unanswered", () => {
    expect(ids({})).toEqual(["a", "d"]);
  });
  it("numeric operators", () => {
    expect(matches(L("r", "gte", "4"), "5")).toBe(true);
    expect(matches(L("r", "gte", "4"), "3")).toBe(false);
    expect(matches(L("r", "lte", "3"), "3")).toBe(true);
    expect(matches(L("r", "lte", "3"), "")).toBe(false);
    expect(matches(L("r", "lte", "3"), "abc")).toBe(false);
  });
  it("ignores answers keyed to unknown ids", () => {
    expect(ids({ zzz: "Yes" })).toEqual(["a", "d"]);
  });
});
