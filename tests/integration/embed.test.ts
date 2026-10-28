import { afterAll, describe, expect, it } from "vitest";
import { Client, db, formWith, newUser, q } from "./helpers";

afterAll(() => db.end());

describe("embedding on external sites", () => {
  it("serves embed.js and the form config cross-origin", async () => {
    const c = new Client();
    const js = await c.get("/embed.js");
    expect(js.status).toBe(200);
    expect(js.text).toContain("data-mode");
    const u = await newUser();
    const { slug } = await formWith(u, [q()], { position: "left", avatar: "🤖" });
    const cfg = await c.req("GET", `/api/public/forms/${slug}`, undefined, { Origin: "https://customer-site.example" });
    expect(cfg.headers.get("access-control-allow-origin")).toBe("*");
    expect(cfg.json).toMatchObject({ position: "left", avatar: "🤖" });
    const missing = await c.req("GET", "/api/public/forms/nope-nope", undefined, { Origin: "https://x.example" });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("access-control-allow-origin")).toBe("*");
    const pre = await c.req("OPTIONS", `/api/public/forms/${slug}`, undefined, { Origin: "https://x.example", "Access-Control-Request-Method": "GET" });
    expect(pre.status).toBeLessThan(300);
  });

  it("the widget page can be framed from anywhere, inline mode too", async () => {
    const u = await newUser();
    const { slug } = await formWith(u, [q()]);
    for (const p of [`/widget/${slug}`, `/widget/${slug}?inline=1`]) {
      const r = await new Client().get(p);
      expect(r.status).toBe(200);
      expect(r.headers.get("content-security-policy")).toContain("frame-ancestors *");
    }
  });
});
