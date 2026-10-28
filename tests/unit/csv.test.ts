import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
  });
  it("neutralises spreadsheet formula injection", () => {
    for (const bad of ["=HYPERLINK(\"http://evil\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd"]) {
      expect(csvCell(bad).replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });
  it("starts with a BOM and uses CRLF", () => {
    const out = toCsv([["a", "b"], ["1", "2"]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain("a,b\r\n1,2\r\n");
  });
});
