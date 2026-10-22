import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "./db";

const COOKIE = "session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "insecure-dev-secret-change-me-please");

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
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

export async function getUser(): Promise<{ id: string; email: string } | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const rows = await query<{ id: string; email: string }>("select id, email from users where id = $1", [payload.uid]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
