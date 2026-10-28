import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("fc") || l.startsWith("fd") || /^fe[89ab]/.test(l)) return true;
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
  }
  return false;
}

/** Throws an Error with a user-facing message if the URL is not a safe public webhook target. */
export async function assertSafeWebhookUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Enter a valid URL, for example https://example.com/hook");
  }
  const allowPrivate = process.env.ALLOW_PRIVATE_WEBHOOKS === "true"; // local development / tests only
  if (u.protocol !== "https:" && !(allowPrivate && u.protocol === "http:")) throw new Error("Webhook URL must start with https://");
  if (u.username || u.password) throw new Error("Don't put credentials in the URL. Use the signing secret instead.");
  if (allowPrivate) return u;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Webhook URL must point to a public server.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("Could not resolve that hostname.");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Webhook URL must point to a public server.");
  return u;
}
