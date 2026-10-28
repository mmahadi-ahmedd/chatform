import { afterAll, describe, expect, it } from "vitest";
import { Client, createForm, db, formWith, getForm, newUser, payload, publish, q, submit, tinyPng } from "./helpers";

afterAll(() => db.end());

describe("templates, builder rules and duplication", () => {
  it("creates a form from a template with working conditional logic", async () => {
    const u = await newUser();
    const id = await createForm(u, "feedback");
    const f = await getForm(u, id);
    expect(f.title).toBe("Customer feedback");
    expect(f.questions.map((x: any) => x.type)).toEqual(["rating", "text", "text", "email"]);
    expect(f.questions[1].logic).toMatchObject({ question_id: f.questions[0].id, op: "lte", value: "3" });
    expect((await u.post("/api/forms", { template: "does-not-exist" })).status).toBe(404);
  });

  it("supports all eight question types", async () => {
    const u = await newUser();
    const types = ["text", "email", "choice", "dropdown", "yesno", "rating", "date", "file"];
    const qs = types.map((type) => q({ type, label: type, options: type === "choice" || type === "dropdown" ? ["A", "B"] : [] }));
    const { form } = await formWith(u, qs);
    expect(form.questions.map((x: any) => x.type)).toEqual(types);
  });

  it("server-side validation rejects bad builder input", async () => {
    const u = await newUser();
    const id = await createForm(u);
    const f = await getForm(u, id);
    const put = (over: any) => u.put(`/api/forms/${id}`, payload(f, over));
    expect((await put({ questions: [q({ type: "script" })] })).status).toBe(400);
    expect((await put({ questions: [q({ type: "choice", options: ["only one"] })] })).status).toBe(400);
    expect((await put({ questions: [q({ label: "  " })] })).status).toBe(400);
    expect((await put({ primary_color: "red" })).status).toBe(400);
    expect((await put({ avatar: "javascript:alert(1)" })).status).toBe(400);
    expect((await put({ position: "top" })).status).toBe(400);
    expect((await put({ title: "" })).status).toBe(400);
    expect((await put({ questions: Array.from({ length: 51 }, () => q()) })).status).toBe(400);
    expect((await put({ questions: [q({ config: { pattern: "(a+)+$" } })] })).status).toBe(400);
    const a = q(), b = q();
    expect((await put({ questions: [{ ...a, logic: { question_id: b.id, op: "equals", value: "x" } }, b] })).status).toBe(400); // depends on a LATER question
    expect((await put({ questions: [a, { ...b, logic: { question_id: a.id, op: "equals", value: "x" } }] })).status).toBe(200);
    expect((await u.patch(`/api/forms/${id}`, { published: "yes" })).status).toBe(400);
  });

  it("cannot publish a form with no questions", async () => {
    const u = await newUser();
    const id = await createForm(u);
    const f = await getForm(u, id);
    expect((await u.put(`/api/forms/${id}`, payload(f, { questions: [], published: true }))).status).toBe(400);
    await u.put(`/api/forms/${id}`, payload(f, { questions: [] }));
    expect((await u.patch(`/api/forms/${id}`, { published: true })).status).toBe(400);
  });

  it("keeps question ids stable across edits and reordering", async () => {
    const u = await newUser();
    const a = q({ label: "A" }), b = q({ label: "B" });
    const { id } = await formWith(u, [a, b]);
    const f = await getForm(u, id);
    const r = await u.put(`/api/forms/${id}`, payload(f, { questions: [{ ...b, label: "B edited" }, a] }));
    expect(r.json.questions.map((x: any) => x.id)).toEqual([b.id, a.id]);
    expect(r.json.questions[0].label).toBe("B edited");
    const after = await u.put(`/api/forms/${id}`, payload(r.json, { questions: [a] })); // delete b
    expect(after.json.questions.map((x: any) => x.id)).toEqual([a.id]);
  });

  it("refuses question ids that belong to another form", async () => {
    const u = await newUser();
    const { form: other } = await formWith(u, [q()]);
    const id = await createForm(u);
    const f = await getForm(u, id);
    const r = await u.put(`/api/forms/${id}`, payload(f, { questions: [q({ id: other.questions[0].id })] }));
    expect(r.status).toBe(400);
    // the other form is untouched
    expect((await getForm(u, other.id)).questions[0].id).toBe(other.questions[0].id);
  });

  it("duplicates a form as an unpublished draft with logic re-pointed at the new ids", async () => {
    const u = await newUser();
    const id = await createForm(u, "event");
    await publish(u, id);
    const src = await getForm(u, id);
    const dup = await u.post(`/api/forms/${id}/duplicate`);
    expect(dup.status).toBe(201);
    const copy = await getForm(u, dup.json.id);
    expect(copy.title).toBe("Event registration (copy)");
    expect(copy.published).toBe(false);
    expect(copy.slug).not.toBe(src.slug);
    expect(copy.questions).toHaveLength(src.questions.length);
    const srcIds = new Set(src.questions.map((x: any) => x.id));
    expect(copy.questions.every((x: any) => !srcIds.has(x.id))).toBe(true);
    const guest = copy.questions.find((x: any) => x.logic);
    expect(copy.questions.some((x: any) => x.id === guest.logic.question_id)).toBe(true);
    expect(copy.primary_color).toBe(src.primary_color);
    expect((await getForm(u, id)).published).toBe(true); // original unchanged
  });
});

describe("public chat: logic, validation and spam protection", () => {
  it("only serves published forms and doesn't leak internal ids", async () => {
    const u = await newUser();
    const id = await createForm(u);
    const f = await getForm(u, id);
    expect((await new Client().get(`/api/public/forms/${f.slug}`)).status).toBe(404);
    await publish(u, id);
    const res = await new Client().get(`/api/public/forms/${f.slug}`);
    expect(res.status).toBe(200);
    expect(res.json.id).toBeUndefined();
    expect(res.json.avatar).toBeDefined();
    expect(res.json.position).toMatch(/left|right/);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    await u.patch(`/api/forms/${id}`, { published: false });
    expect((await new Client().get(`/api/public/forms/${f.slug}`)).status).toBe(404);
    expect((await submit(f.slug, {})).status).toBe(404);
  });

  it("applies conditional logic on the server: hidden questions are skipped and their answers discarded", async () => {
    const u = await newUser();
    const id = await createForm(u, "feedback");
    const slug = await publish(u, id);
    const [rate, bad, good] = (await getForm(u, id)).questions;
    // rating 5: "what went wrong" is hidden, "what did you like" (optional) is shown
    const ok = await submit(slug, { [rate.id]: "5", [bad.id]: "this should be ignored" });
    expect(ok.status).toBe(201);
    const stored = (await db.query("select answers from responses r join forms f on f.id = r.form_id where f.slug = $1 order by submitted_at desc limit 1", [slug])).rows[0].answers;
    expect(stored.map((a: any) => a.question_id)).toEqual([rate.id, good.id, expect.any(String)].slice(0, stored.length));
    expect(stored.find((a: any) => a.question_id === bad.id)).toBeUndefined();
    // rating 2: the follow-up is now required
    const missing = await submit(slug, { [rate.id]: "2" });
    expect(missing.status).toBe(400);
    expect(missing.json.error).toMatch(/went wrong/);
    expect((await submit(slug, { [rate.id]: "2", [bad.id]: "slow support" })).status).toBe(201);
  });

  it("validates every question type", async () => {
    const u = await newUser();
    const qs = [
      q({ type: "email", label: "Email" }),
      q({ type: "dropdown", label: "Plan", options: ["Free", "Pro"] }),
      q({ type: "rating", label: "Stars", config: { max: 5 } }),
      q({ type: "date", label: "When", config: { min_date: "2026-01-01", max_date: "2026-12-31" } }),
      q({ type: "text", label: "Code", config: { pattern: "^[0-9]{4}$", pattern_message: "4 digits" } }),
      q({ type: "yesno", label: "Agree?" }),
    ];
    const { slug } = await formWith(u, qs);
    const good = { [qs[0].id]: "a@b.co", [qs[1].id]: "Pro", [qs[2].id]: "4", [qs[3].id]: "2026-06-01", [qs[4].id]: "1234", [qs[5].id]: "Yes" };
    for (const [i, bad] of [[0, "nope"], [1, "Enterprise"], [2, "9"], [3, "2027-01-01"], [3, "2026-02-30"], [4, "12"], [5, "Maybe"]] as const) {
      const r = await submit(slug, { ...good, [qs[i].id]: bad });
      expect(r.status, `${qs[i].label}=${bad}`).toBe(400);
    }
    expect((await submit(slug, good)).status).toBe(201);
  });

  it("ignores unknown answer keys and rejects oversized or malformed bodies", async () => {
    const u = await newUser();
    const { slug, form } = await formWith(u, [q()]);
    expect((await submit(slug, { [form.questions[0].id]: "x".repeat(2001) })).status).toBe(400);
    expect((await new Client().post(`/api/public/forms/${slug}/responses`, { answers: "nope" })).status).toBe(400);
    expect((await new Client().post(`/api/public/forms/${slug}/responses`, "garbage")).status).toBe(400);
    expect((await submit(slug, { [form.questions[0].id]: "ok", __proto__: "x", "'; drop table users; --": "x" } as any)).status).toBe(201);
    expect((await db.query("select count(*)::int n from users")).rows[0].n).toBeGreaterThan(0);
  });

  it("honeypot submissions are silently dropped, duplicates are blocked", async () => {
    const u = await newUser();
    const { slug, form } = await formWith(u, [q()]);
    const count = async () => (await db.query("select count(*)::int n from responses r join forms f on f.id = r.form_id where f.slug = $1", [slug])).rows[0].n;
    const bot = new Client();
    expect((await submit(slug, { [form.questions[0].id]: "buy now" }, bot, { website: "http://spam.example" })).status).toBe(201);
    expect(await count()).toBe(0);
    const human = new Client();
    expect((await submit(slug, { [form.questions[0].id]: "hello" }, human)).status).toBe(201);
    expect((await submit(slug, { [form.questions[0].id]: "hello" }, human)).status).toBe(409);
    expect((await submit(slug, { [form.questions[0].id]: "hello again" }, human)).status).toBe(201);
    expect(await count()).toBe(2);
  });
});

describe("file uploads", () => {
  async function fileForm() {
    const owner = await newUser();
    const file = q({ type: "file", label: "CV" });
    const text = q({ type: "text", label: "Name" });
    const { slug, form } = await formWith(owner, [text, file]);
    return { owner, slug, form, file: form.questions[1], text: form.questions[0] };
  }
  const upload = (c: Client, slug: string, qid: string, blob: Blob, name = "cv.png") => {
    const fd = new FormData();
    fd.append("file", blob, name);
    fd.append("question_id", qid);
    return c.req("POST", `/api/public/forms/${slug}/upload`, undefined, {}, fd);
  };

  it("accepts a valid file, stores it privately, and the owner can download it", async () => {
    const { owner, slug, file, text, form } = await fileForm();
    const visitor = new Client();
    const up = await upload(visitor, slug, file.id, tinyPng(), "my cv.png");
    expect(up.status).toBe(201);
    expect(up.json.name).toBe("my cv.png");
    expect((await submit(slug, { [text.id]: "Sam", [file.id]: up.json.file_id }, visitor)).status).toBe(201);
    const list = (await owner.get(`/api/forms/${form.id}/responses`)).json;
    const ans = list.rows[0].answers.find((a: any) => a.file_id);
    expect(ans.value).toBe("my cv.png");
    const dl = await owner.get(`/api/uploads/${ans.file_id}`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("image/png");
    expect(dl.headers.get("content-disposition")).toMatch(/attachment/);
    expect(dl.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("rejects wrong types, fake content, empty and oversized files", async () => {
    const { slug, file, text } = await fileForm();
    const c = new Client();
    expect((await upload(c, slug, file.id, new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "x.html")).status).toBe(415);
    expect((await upload(c, slug, file.id, new Blob(["not really a png"], { type: "image/png" }))).status).toBe(415);
    expect((await upload(c, slug, file.id, new Blob([], { type: "image/png" }))).status).toBe(400);
    expect((await upload(c, slug, file.id, new Blob([Buffer.alloc(2 * 1024 * 1024 + 10)], { type: "application/pdf" }), "big.pdf")).status).toBe(413);
    expect((await upload(c, slug, text.id, tinyPng())).status).toBe(400); // not a file question
    expect((await upload(c, "does-not-exist", file.id, tinyPng())).status).toBe(404);
  });

  it("a response can't reference a file uploaded to a different form", async () => {
    const a = await fileForm();
    const b = await fileForm();
    const up = await upload(new Client(), a.slug, a.file.id, tinyPng());
    const r = await submit(b.slug, { [b.text.id]: "Sam", [b.file.id]: up.json.file_id });
    expect(r.status).toBe(400);
  });
});
