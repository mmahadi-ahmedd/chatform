import { afterAll, describe, expect, it } from "vitest";
import { Client, db, formWith, getForm, newAdmin, newUser, payload, q, submit, tinyPng } from "./helpers";

afterAll(() => db.end());

/** The core promise: one user can never read or change another user's data. */
describe("authorization: users cannot touch each other's data", () => {
  async function setup() {
    const alice = await newUser("alice");
    const bob = await newUser("bob");
    const { id, slug, form } = await formWith(alice, [q({ label: "Secret question" }), q({ type: "file", label: "Doc" })]);
    // a response with a file, and a design preset, all owned by Alice
    const fd = new FormData();
    fd.append("file", tinyPng(), "private.png");
    fd.append("question_id", form.questions[1].id);
    const visitor = new Client();
    const up = await visitor.req("POST", `/api/public/forms/${slug}/upload`, undefined, {}, fd);
    await submit(slug, { [form.questions[0].id]: "alice's private answer", [form.questions[1].id]: up.json.file_id }, visitor);
    const resp = (await alice.get(`/api/forms/${id}/responses`)).json.rows[0];
    const preset = (await alice.post("/api/presets", { name: "Mine", primary_color: "#112233", avatar: "💬", position: "left", welcome_message: "hi", completion_message: "bye" })).json;
    return { alice, bob, id, slug, form, resp, fileId: up.json.file_id as string, preset };
  }

  it("Bob gets 404 (not 403) for every one of Alice's form endpoints", async () => {
    const { alice, bob, id, form, resp } = await setup();
    const body = payload(form, { title: "hijacked" });
    const attempts: [string, Promise<any>][] = [
      ["GET form", bob.get(`/api/forms/${id}`)],
      ["PUT form", bob.put(`/api/forms/${id}`, body)],
      ["PATCH form", bob.patch(`/api/forms/${id}`, { published: false })],
      ["DELETE form", bob.del(`/api/forms/${id}`)],
      ["duplicate", bob.post(`/api/forms/${id}/duplicate`)],
      ["list responses", bob.get(`/api/forms/${id}/responses`)],
      ["delete response", bob.del(`/api/forms/${id}/responses/${resp.id}`)],
      ["analytics", bob.get(`/api/forms/${id}/analytics`)],
      ["export CSV", bob.get(`/api/forms/${id}/export`)],
      ["get integrations", bob.get(`/api/forms/${id}/integrations`)],
      ["set integrations", bob.put(`/api/forms/${id}/integrations`, { notify_enabled: true, notify_email: "bob@evil.test", webhook_url: "https://evil.test/steal" })],
      ["regenerate secret", bob.post(`/api/forms/${id}/integrations`)],
      ["deliveries", bob.get(`/api/forms/${id}/deliveries`)],
      ["retry delivery", bob.post(`/api/forms/${id}/deliveries/${crypto.randomUUID()}/retry`)],
    ];
    for (const [name, p] of attempts) expect((await p).status, name).toBe(404);

    // nothing changed
    const still = await getForm(alice, id);
    expect(still.title).not.toBe("hijacked");
    expect(still.published).toBe(true);
    expect((await alice.get(`/api/forms/${id}/responses`)).json.total).toBe(1);
    const cfg = (await db.query("select notify_email, webhook_url from forms where id = $1", [id])).rows[0];
    expect(cfg).toEqual({ notify_email: "", webhook_url: "" });
  });

  it("Bob can't see Alice's forms in his list, files, or presets", async () => {
    const { alice, bob, id, fileId, preset } = await setup();
    expect((await bob.get("/api/forms")).json).toEqual([]);
    expect((await alice.get("/api/forms")).json.map((f: any) => f.id)).toContain(id);
    expect((await bob.get(`/api/uploads/${fileId}`)).status).toBe(404);
    expect((await alice.get(`/api/uploads/${fileId}`)).status).toBe(200);
    expect((await bob.get("/api/presets")).json).toEqual([]);
    expect((await bob.del(`/api/presets/${preset.id}`)).status).toBe(404);
    expect((await alice.get("/api/presets")).json).toHaveLength(1);
    expect((await bob.get(`/dashboard/forms/${id}`)).status).toBe(404);
  });

  it("anonymous visitors can't use owner endpoints or download files", async () => {
    const { id, fileId, resp } = await setup();
    const anon = new Client();
    for (const [m, p] of [["GET", `/api/forms/${id}`], ["GET", `/api/forms/${id}/responses`], ["GET", `/api/forms/${id}/export`], ["GET", `/api/forms/${id}/analytics`], ["GET", `/api/forms/${id}/integrations`], ["DELETE", `/api/forms/${id}/responses/${resp.id}`], ["GET", `/api/uploads/${fileId}`], ["GET", "/api/presets"]] as const)
      expect((await anon.req(m, p)).status, `${m} ${p}`).toBe(401);
  });

  it("malformed ids and injection attempts don't cause errors or leaks", async () => {
    const { alice, id } = await setup();
    for (const bad of ["not-a-uuid", "1' OR '1'='1", "../../etc/passwd", "%00"]) {
      expect((await alice.get(`/api/forms/${encodeURIComponent(bad)}`)).status, bad).toBe(404);
    }
    const r = await alice.get(`/api/forms/${id}/responses?q=${encodeURIComponent("'; drop table responses; --")}&from=garbage&page=-5&sort=;`);
    expect(r.status).toBe(200);
    expect((await alice.get(`/api/forms/${id}/responses?q=%25`)).json.total).toBe(0); // % is literal, not a wildcard
    expect((await db.query("select count(*)::int n from responses")).rows[0].n).toBeGreaterThan(0);
  });

  it("owners can't smuggle a webhook to internal addresses", async () => {
    const { alice, id } = await setup();
    // This server runs with ALLOW_PRIVATE_WEBHOOKS=true for tests, but credentials in URLs are always refused
    const r = await alice.put(`/api/forms/${id}/integrations`, { notify_enabled: false, notify_email: "", webhook_url: "https://user:pass@example.com/hook" });
    expect(r.status).toBe(400);
    expect((await alice.put(`/api/forms/${id}/integrations`, { notify_enabled: false, notify_email: "", webhook_url: "ftp://example.com" })).status).toBe(400);
    expect((await alice.put(`/api/forms/${id}/integrations`, { notify_enabled: true, notify_email: "not-an-email", webhook_url: "" })).status).toBe(400);
  });
});

describe("role-based access control", () => {
  it("normal users can't use admin APIs or pages", async () => {
    const user = await newUser();
    const victim = await newUser();
    const vid = (await db.query("select id from users where email = $1", [victim.email])).rows[0].id;
    expect((await user.patch(`/api/admin/users/${vid}`, { suspended: true })).status).toBe(403);
    expect((await new Client().patch(`/api/admin/users/${vid}`, { suspended: true })).status).toBe(403);
    expect((await victim.get("/api/forms")).status).toBe(200); // still active
    for (const p of ["/admin", "/admin/users", "/admin/activity"]) {
      expect((await user.get(p)).status, p).toBe(404);
      expect((await new Client().get(p)).status, `anon ${p}`).toBe(307);
    }
  });

  it("a user can't promote themselves through any public API", async () => {
    const user = await newUser();
    await user.put("/api/forms/x", { role: "admin" });
    await user.post("/api/auth/signup", { email: `x-${Date.now()}@test.local`, password: "Password123!x", role: "admin" });
    expect((await db.query("select role from users where email = $1", [user.email])).rows[0].role).toBe("user");
    expect((await user.get("/admin")).status).toBe(404);
  });

  it("admins can use admin pages but can't suspend themselves or other admins", async () => {
    const admin = await newAdmin();
    const other = await newAdmin();
    const ids = Object.fromEntries((await db.query("select email, id from users where email = any($1)", [[admin.email, other.email]])).rows.map((r: any) => [r.email, r.id]));
    expect((await admin.patch(`/api/admin/users/${ids[admin.email]}`, { suspended: true })).status).toBe(400);
    expect((await admin.patch(`/api/admin/users/${ids[other.email]}`, { suspended: true })).status).toBe(400);
    expect((await admin.patch(`/api/admin/users/${crypto.randomUUID()}`, { suspended: true })).status).toBe(404);
    expect((await admin.patch(`/api/admin/users/${ids[other.email]}`, { suspended: "yes" })).status).toBe(400);
    expect((await admin.get("/api/forms")).status).toBe(200);
  });
});

describe("security headers", () => {
  it("sets clickjacking and sniffing protections on account pages, and allows framing only for the widget", async () => {
    const c = new Client();
    const login = await c.get("/login");
    expect(login.headers.get("x-frame-options")).toBe("DENY");
    expect(login.headers.get("x-content-type-options")).toBe("nosniff");
    expect(login.headers.get("x-powered-by")).toBeNull();
    const user = await newUser();
    const { slug } = await formWith(user, [q()]);
    const widget = await c.get(`/widget/${slug}`);
    expect(widget.headers.get("content-security-policy")).toContain("frame-ancestors *");
    expect(widget.headers.get("x-frame-options")).toBeNull();
  });
});
