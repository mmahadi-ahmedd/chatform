import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "./db";
import { authSecret } from "./env";
import { isUuid } from "./validate";

const COOKIE = "session";
const secret = () => new TextEncoder().encode(authSecret());

export interface SessionUser {
  id: string;
  email: string;
  role: "user" | "admin";
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

/** The signed-in user, or null. Suspended accounts are treated as signed out on every request. */
export async function getUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!isUuid(payload.uid)) return null;
    const rows = await query<SessionUser & { suspended: boolean }>(
      "select id, email, role, suspended from users where id = $1",
      [payload.uid]
    );
    const u = rows[0];
    if (!u || u.suspended) return null;
    return { id: u.id, email: u.email, role: u.role };
  } catch {
    return null;
  }
}

/** Admin-only helper for API routes and pages. */
export async function getAdmin(): Promise<SessionUser | null> {
  const u = await getUser();
  return u && u.role === "admin" ? u : null;
}
