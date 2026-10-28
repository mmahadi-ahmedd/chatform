import { afterAll, describe, expect, it } from "vitest";
import { Client, PASSWORD, createForm, db, formWith, newAdmin, newUser, publish, q } from "./helpers";

afterAll(() => db.end());

describe("authentication", () => {
  it("validates signup input", async () => {
    const c = new Client();
    expect((await c.post("/api/auth/signup", { email: "nope", password: PASSWORD })).status).toBe(400);
    expect((await c.post("/api/auth/signup", { email: "a@test.local", password: "short" })).status).toBe(400);
    expect((await c.post("/api/auth/signup", { email: "a@test.local", password: "x".repeat(73) })).status).toBe(400);
    expect((await c.post("/api/auth/signup", { email: "same@test.local", password: "same@test.local" })).status).toBe(400);
  });

  it("rejects duplicate emails and never stores plaintext passwords", async () => {
    const u = await newUser();
    const dup = await new Client().post("/api/auth/signup", { email: u.email.toUpperCase(), password: PASSWORD });
    expect(dup.status).toBe(409);
    const row = (await db.query("select password_hash from users where email = $1", [u.email])).rows[0];
    expect(row.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.password_hash).not.toContain(PASSWORD);
  });

  it("logs in with correct credentials and gives a generic error otherwise", async () => {
    const u = await newUser();
    const ok = new Client();
    expect((await ok.post("/api/auth/login", { email: u.email, password: PASSWORD })).status).toBe(200);
    expect((await ok.get("/api/forms")).status).toBe(200);
    const wrong = await new Client().post("/api/auth/login", { email: u.email, password: "wrong-password" });
    const unknown = await new Client().post("/api/auth/login", { email: "ghost@test.local", password: "wrong-password" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json.error).toBe(unknown.json.error); // can't tell which emails exist
  });

  it("session cookie is HttpOnly and SameSite=Lax", async () => {
    const c = new Client();
    const email = `cookie-${Date.now()}@test.local`;
    const res = await fetch(`${process.env.TEST_BASE_URL}/api/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": c.ip }, body: JSON.stringify({ email, password: PASSWORD }),
    });
    const cookie = res.headers.getSetCookie().find((x) => x.startsWith("session="))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("requires a session for the API", async () => {
    const anon = new Client();
    expect((await anon.get("/api/forms")).status).toBe(401);
    expect((await anon.post("/api/forms")).status).toBe(401);
    expect((await anon.get("/dashboard")).status).toBe(307);
  });

  it("logout clears the session", async () => {
    const u = await newUser();
    expect((await u.post("/api/auth/logout")).status).toBe(200);
    expect((await u.get("/api/forms")).status).toBe(401);
  });

  it("a forged or tampered session cookie is rejected", async () => {
    const u = await newUser();
    const forged = new Client();
    forged.cookie = u.cookie.slice(0, -3) + "abc";
    expect((await forged.get("/api/forms")).status).toBe(401);
    forged.cookie = "session=eyJhbGciOiJub25lIn0.eyJ1aWQiOiIxMTExMTExMS0xMTExLTExMTEtMTExMS0xMTExMTExMTExMTEifQ.";
    expect((await forged.get("/api/forms")).status).toBe(401);
  });
});

describe("rate limiting", () => {
  it("throttles repeated failed logins for one account (429 + Retry-After)", async () => {
    const u = await newUser();
    let last: any;
    for (let i = 0; i < 10; i++) last = await new Client().post("/api/auth/login", { email: u.email, password: "bad-password" });
    expect(last.status).toBe(429);
    expect(Number(last.headers.get("retry-after"))).toBeGreaterThan(0);
    // even the right password is refused while locked out
    expect((await new Client().post("/api/auth/login", { email: u.email, password: PASSWORD })).status).toBe(429);
  });

  it("limits sign-ups per IP", async () => {
    const c = new Client();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await c.post("/api/auth/signup", { email: `rl-${Date.now()}-${i}@test.local`, password: PASSWORD })).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[6]).toBe(429);
  });

  it("limits public submissions per visitor", async () => {
    const owner = await newUser();
    const { slug, form } = await formWith(owner, [q({ type: "text", label: "Say something" })]);
    const visitor = new Client();
    const out: number[] = [];
    for (let i = 0; i < 12; i++) out.push((await visitor.post(`/api/public/forms/${slug}/responses`, { answers: { [form.questions[0].id]: `msg ${i}` } })).status);
    expect(out.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(out[11]).toBe(429);
  });
});

describe("CSRF protection", () => {
  it("rejects cross-site state-changing requests", async () => {
    const u = await newUser();
    expect((await u.req("POST", "/api/forms", {}, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await u.req("POST", "/api/forms", {}, { "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
    const host = new URL(process.env.TEST_BASE_URL!).host;
    expect((await u.req("POST", "/api/forms", {}, { Origin: `http://${host}`, "Sec-Fetch-Site": "same-origin" })).status).toBe(201);
  });
});

describe("account suspension", () => {
  it("suspended users are signed out, can't log in, and their public forms go dark", async () => {
    const admin = await newAdmin();
    const user = await newUser();
    const { slug } = await formWith(user, [q()]);
    expect((await new Client().get(`/api/public/forms/${slug}`)).status).toBe(200);
    const id = (await db.query("select id from users where email = $1", [user.email])).rows[0].id;

    expect((await admin.patch(`/api/admin/users/${id}`, { suspended: true })).status).toBe(200);
    expect((await user.get("/api/forms")).status).toBe(401); // existing session no longer valid
    const login = await new Client().post("/api/auth/login", { email: user.email, password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.json.error).toMatch(/suspended/i);
    expect((await new Client().get(`/api/public/forms/${slug}`)).status).toBe(404);

    expect((await admin.patch(`/api/admin/users/${id}`, { suspended: false })).status).toBe(200);
    expect((await user.get("/api/forms")).status).toBe(200);
    expect((await new Client().get(`/api/public/forms/${slug}`)).status).toBe(200);
  });
});
