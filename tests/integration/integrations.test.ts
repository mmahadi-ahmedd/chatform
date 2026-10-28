import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MOCK_PORT, db, formWith, newUser, q, startMock, submit } from "./helpers";

let mock: Awaited<ReturnType<typeof startMock>>;
beforeAll(async () => { mock = await startMock(); });
afterAll(async () => { mock.close(); await db.end(); });

const until = async <T>(fn: () => Promise<T | undefined | false>, ms = 8000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 150));
  }
};
const hook = `http://localhost:${MOCK_PORT}/hook`;

describe("webhooks", () => {
  it("signs payloads, shows the secret once, stores it encrypted", async () => {
    mock.hits.length = 0; mock.state.status = 200;
    const u = await newUser();
    const f = q({ label: "Name" });
    const { id, slug } = await formWith(u, [f]);
    const set = await u.put(`/api/forms/${id}/integrations`, { notify_enabled: false, notify_email: "", webhook_url: hook });
    expect(set.status).toBe(200);
    expect(set.json.secret).toMatch(/^whsec_/);
    const again = await u.put(`/api/forms/${id}/integrations`, { notify_enabled: false, notify_email: "", webhook_url: hook });
    expect(again.json.secret).toBeUndefined();
    expect((await u.get(`/api/forms/${id}/integrations`)).json.secret).toBeUndefined();
    const stored = (await db.query("select webhook_secret_enc from forms where id=$1", [id])).rows[0].webhook_secret_enc;
    expect(stored).toMatch(/^v1\./);
    expect(stored).not.toContain(set.json.secret);

    await submit(slug, { [f.id]: "Sam" });
    const hit = await until(async () => mock.hits.find((h) => h.url === "/hook"));
    const ts = hit.headers["x-chatform-timestamp"] as string;
    const expected = "sha256=" + createHmac("sha256", set.json.secret).update(`${ts}.${hit.body}`).digest("hex");
    expect(hit.headers["x-chatform-signature"]).toBe(expected);
    expect(hit.headers["x-chatform-event"]).toBe("response.created");
    const body = JSON.parse(hit.body);
    expect(body.response.answers[0]).toMatchObject({ label: "Name", value: "Sam" });
    const log = await until(async () => { const d = (await u.get(`/api/forms/${id}/deliveries`)).json; return d[0]?.status === "success" ? d : undefined; });
    expect(log[0]).toMatchObject({ kind: "webhook", status: "success", status_code: 200 });
  });

  it("records failures with retries, then lets the owner retry successfully", async () => {
    mock.hits.length = 0; mock.state.status = 500;
    const u = await newUser();
    const f = q();
    const { id, slug } = await formWith(u, [f]);
    await u.put(`/api/forms/${id}/integrations`, { notify_enabled: false, notify_email: "", webhook_url: hook });
    await submit(slug, { [f.id]: "x" });
    const failed = await until(async () => { const d = (await u.get(`/api/forms/${id}/deliveries`)).json; return d[0]?.status === "failed" ? d[0] : undefined; });
    expect(failed.attempts).toBe(2);
    expect(failed.status_code).toBe(500);
    mock.state.status = 200;
    const r = await u.post(`/api/forms/${id}/deliveries/${failed.id}/retry`);
    expect(r.status).toBe(200);
    const ok = await until(async () => { const d = (await u.get(`/api/forms/${id}/deliveries`)).json; return d[0]?.status === "success" ? d[0] : undefined; });
    expect(ok.id).toBe(failed.id);
  });

  it("clearing the URL removes the secret", async () => {
    const u = await newUser();
    const { id } = await formWith(u, [q()]);
    await u.put(`/api/forms/${id}/integrations`, { notify_enabled: false, notify_email: "", webhook_url: hook });
    await u.put(`/api/forms/${id}/integrations`, { notify_enabled: false, notify_email: "", webhook_url: "" });
    expect((await db.query("select webhook_secret_enc from forms where id=$1", [id])).rows[0].webhook_secret_enc).toBe("");
  });
});

describe("email notifications", () => {
  it("sends through the mail API with the key and right recipient", async () => {
    mock.hits.length = 0; mock.state.status = 200;
    const u = await newUser();
    const f = q({ label: "Name" });
    const { id, slug } = await formWith(u, [f]);
    await u.put(`/api/forms/${id}/integrations`, { notify_enabled: true, notify_email: "boss@example.com", webhook_url: "" });
    await submit(slug, { [f.id]: "Dana" });
    const hit = await until(async () => mock.hits.find((h) => h.url === "/emails"));
    expect(hit.headers.authorization).toBe("Bearer test-key");
    const mail = JSON.parse(hit.body);
    expect(JSON.stringify(mail.to)).toContain("boss@example.com");
    expect(JSON.stringify(mail)).toContain("Dana");
    const d = await until(async () => { const l = (await u.get(`/api/forms/${id}/deliveries`)).json; return l.find((x: any) => x.kind === "email" && x.status === "success"); });
    expect(d).toBeTruthy();
  });

  it("a failing mail provider never breaks the visitor's submission", async () => {
    mock.hits.length = 0; mock.state.status = 500;
    const u = await newUser();
    const f = q();
    const { id, slug } = await formWith(u, [f]);
    await u.put(`/api/forms/${id}/integrations`, { notify_enabled: true, notify_email: "", webhook_url: "" });
    expect((await submit(slug, { [f.id]: "x" })).status).toBe(201);
    const d = await until(async () => (await u.get(`/api/forms/${id}/deliveries`)).json.find((x: any) => x.kind === "email" && x.status === "failed"));
    expect(d.error).toBeTruthy();
    mock.state.status = 200;
  });
});
