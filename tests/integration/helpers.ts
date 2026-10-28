import http from "node:http";
import { randomBytes } from "node:crypto";
import pg from "pg";

export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3100";
export const MOCK_PORT = Number(process.env.TEST_MOCK_PORT ?? 4010);
export const PASSWORD = "Password123!x";

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 3,
});

const rand = () => randomBytes(4).toString("hex");
/** Every client gets its own fake IP so rate-limit tests don't affect each other. */
export const fakeIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

export interface Res<T = any> {
  status: number;
  json: T;
  text: string;
  headers: Headers;
}

export class Client {
  cookie = "";
  email = "";
  constructor(public ip = fakeIp()) {}

  async req<T = any>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}, raw?: BodyInit): Promise<Res<T>> {
    const headers: Record<string, string> = { "X-Forwarded-For": this.ip, ...extra };
    if (this.cookie) headers.Cookie = this.cookie;
    let payload: BodyInit | undefined = raw;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("session=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  get = <T = any>(p: string, h?: Record<string, string>) => this.req<T>("GET", p, undefined, h);
  post = <T = any>(p: string, b?: unknown, h?: Record<string, string>) => this.req<T>("POST", p, b ?? {}, h);
  put = <T = any>(p: string, b: unknown) => this.req<T>("PUT", p, b);
  patch = <T = any>(p: string, b: unknown) => this.req<T>("PATCH", p, b);
  del = <T = any>(p: string) => this.req<T>("DELETE", p);
}

export async function newUser(prefix = "user"): Promise<Client> {
  const c = new Client();
  c.email = `${prefix}-${Date.now()}-${rand()}@test.local`;
  const r = await c.post("/api/auth/signup", { email: c.email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`signup failed: ${r.status} ${r.text}`);
  return c;
}

export async function newAdmin(): Promise<Client> {
  const c = await newUser("admin");
  await db.query("update users set role = 'admin' where email = $1", [c.email]);
  return c;
}

export async function createForm(c: Client, template?: string): Promise<string> {
  const r = await c.post("/api/forms", template ? { template } : {});
  if (r.status !== 201) throw new Error(`create failed: ${r.status} ${r.text}`);
  return r.json.id;
}

/** Build a PUT body from a form returned by the API, with overrides. */
export function payload(form: any, over: Record<string, unknown> = {}) {
  return {
    title: form.title,
    description: form.description,
    welcome_message: form.welcome_message,
    completion_message: form.completion_message,
    primary_color: form.primary_color,
    avatar: form.avatar,
    position: form.position,
    questions: form.questions.map((q: any) => ({ id: q.id, type: q.type, label: q.label, required: q.required, options: q.options, config: q.config, logic: q.logic })),
    ...over,
  };
}

export async function getForm(c: Client, id: string) {
  const r = await c.get(`/api/forms/${id}`);
  if (r.status !== 200) throw new Error(`get failed: ${r.status}`);
  return r.json;
}

export async function publish(c: Client, id: string) {
  const r = await c.patch(`/api/forms/${id}`, { published: true });
  if (r.status !== 200) throw new Error(`publish failed: ${r.status} ${r.text}`);
  return (await getForm(c, id)).slug as string;
}

export const q = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(), type: "text", label: "Question", required: true, options: [], config: {}, logic: null, ...over,
});

/** Create + publish a form from a list of questions. Returns {id, slug, form}. */
export async function formWith(c: Client, questions: any[], over: Record<string, unknown> = {}) {
  const id = await createForm(c);
  const form = await getForm(c, id);
  const r = await c.put(`/api/forms/${id}`, payload(form, { questions, ...over }));
  if (r.status !== 200) throw new Error(`put failed: ${r.status} ${r.text}`);
  const slug = await publish(c, id);
  return { id, slug, form: r.json };
}

/** Submit as an anonymous visitor (own IP unless a client is given). */
export const submit = (slug: string, answers: Record<string, string>, as: Client = new Client(), extra: Record<string, unknown> = {}) =>
  as.post(`/api/public/forms/${slug}/responses`, { answers, ...extra });

// ---------- tiny mock HTTP server (webhook receiver + email provider) ----------
export interface Hit { url: string; headers: http.IncomingHttpHeaders; body: string }
export function startMock() {
  const hits: Hit[] = [];
  const state = { status: 200 };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      hits.push({ url: req.url ?? "", headers: req.headers, body });
      res.statusCode = state.status;
      res.end("{}");
    });
  });
  return new Promise<{ hits: Hit[]; state: typeof state; close: () => void }>((resolve) =>
    server.listen(MOCK_PORT, () => resolve({ hits, state, close: () => server.close() }))
  );
}

export const tinyPng = () => new Blob([Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])], { type: "image/png" });
