import { afterAll, describe, expect, it } from "vitest";
import { BASE, Client, db, formWith, newUser, q, submit } from "./helpers";

afterAll(() => db.end());
const sid = () => `sid-${crypto.randomUUID()}`;
const beacon = (c: Client, slug: string, type: string, s: string) => c.post(`/api/public/forms/${slug}/event`, { type, sid: s });

describe("analytics", () => {
  it("counts unique views/starts, completion + abandonment, and question stats", async () => {
    const u = await newUser();
    const choice = q({ type: "choice", label: "Colour", options: ["Red", "Blue"] });
    const rating = q({ type: "rating", label: "Stars", config: { max: 5 } });
    const { id, slug } = await formWith(u, [choice, rating]);
    const visitors = [0, 1, 2, 3].map(() => ({ c: new Client(), s: sid() }));
    for (const v of visitors) { await beacon(v.c, slug, "view", v.s); await beacon(v.c, slug, "view", v.s); } // dupes ignored
    for (const v of visitors.slice(0, 3)) await beacon(v.c, slug, "start", v.s);
    await submit(slug, { [choice.id]: "Red", [rating.id]: "4" }, visitors[0].c);
    await submit(slug, { [choice.id]: "Red", [rating.id]: "2" }, visitors[1].c);

    const a = (await u.get(`/api/forms/${id}/analytics`)).json;
    expect(a.totals).toMatchObject({ views: 4, starts: 3, completed: 2 });
    expect(a.totals.completionRate).toBeCloseTo(2 / 3);
    expect(a.totals.abandonmentRate).toBeCloseTo(1 / 3);
    const cs = a.questions.find((x: any) => x.id === choice.id);
    expect(cs.distribution).toEqual([{ value: "Red", count: 2 }, { value: "Blue", count: 0 }]);
    const rs = a.questions.find((x: any) => x.id === rating.id);
    expect(rs.average).toBe(3);
    expect(a.daily.at(-1)).toMatchObject({ views: 4, starts: 3, completed: 2 });
  });

  it("returns null rates (not NaN) with no data, and honours the date filter", async () => {
    const u = await newUser();
    const { id, slug } = await formWith(u, [q()]);
    const empty = (await u.get(`/api/forms/${id}/analytics`)).json;
    expect(empty.totals.completionRate).toBeNull();
    expect(empty.totals.abandonmentRate).toBeNull();
    await beacon(new Client(), slug, "view", sid());
    const past = (await u.get(`/api/forms/${id}/analytics?from=2020-01-01&to=2020-01-31`)).json;
    expect(past.totals.views).toBe(0);
    expect(past.daily).toHaveLength(31);
    const swapped = (await u.get(`/api/forms/${id}/analytics?from=2020-01-31&to=2020-01-01`)).json;
    expect(swapped.range).toEqual({ from: "2020-01-01", to: "2020-01-31" });
    expect((await u.get(`/api/forms/${id}/analytics?from=garbage`)).status).toBe(200);
  });

  it("rejects malformed beacons and unknown forms", async () => {
    const u = await newUser();
    const { slug } = await formWith(u, [q()]);
    expect((await beacon(new Client(), slug, "hack", sid())).status).toBe(400);
    expect((await beacon(new Client(), slug, "view", "x")).status).toBe(400);
    expect((await beacon(new Client(), "nope-nope", "view", sid())).status).toBe(404);
  });
});

describe("CSV export", () => {
  it("exports with BOM, proper quoting and a formula-injection guard", async () => {
    const u = await newUser();
    const a = q({ label: 'Say "hi", ok' }), b = q({ label: "Notes" });
    const { id, slug } = await formWith(u, [a, b]);
    await submit(slug, { [a.id]: "=HYPERLINK(\"http://evil\")", [b.id]: "line1\nline2, with comma" });
    const res = await u.get(`/api/forms/${id}/export`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    const raw = new Uint8Array(await (await fetch(`${BASE}/api/forms/${id}/export`, { headers: { Cookie: u.cookie } })).arrayBuffer());
    expect([raw[0], raw[1], raw[2]]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const text = res.text;
    expect(text).toContain('"Say ""hi"", ok"');
    expect(text).toContain(`'=HYPERLINK`);
    expect(text).not.toMatch(/,=HYPERLINK/);
    expect(text).toContain('"line1\nline2, with comma"');
  });
});

describe("responses list", () => {
  it("searches, sorts, paginates and deletes", async () => {
    const u = await newUser();
    const a = q({ label: "Name" });
    const { id, slug } = await formWith(u, [a]);
    for (const n of ["Zed", "Amy", "Bob"]) await submit(slug, { [a.id]: n });
    const all = (await u.get(`/api/forms/${id}/responses`)).json;
    expect(all.total).toBe(3);
    expect((await u.get(`/api/forms/${id}/responses?q=amy`)).json.total).toBe(1);
    const old = (await u.get(`/api/forms/${id}/responses?sort=oldest`)).json.rows;
    const newest = (await u.get(`/api/forms/${id}/responses?sort=newest`)).json.rows;
    expect(old[0].id).toBe(newest[2].id);
    expect((await u.get(`/api/forms/${id}/responses?from=2020-01-01&to=2020-01-02`)).json.total).toBe(0);
    expect((await u.del(`/api/forms/${id}/responses/${all.rows[0].id}`)).status).toBe(200);
    expect((await u.get(`/api/forms/${id}/responses`)).json.total).toBe(2);
  });
});
