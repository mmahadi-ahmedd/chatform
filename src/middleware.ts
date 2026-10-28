import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF defence for every state-changing API call: browsers always attach Origin / Sec-Fetch-Site
 * to cross-site requests, so a request coming from another website is rejected.
 * (Our embed widget runs in an iframe on OUR origin, so its calls are same-origin.)
 */
export function middleware(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return NextResponse.next();
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return deny();
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.get("host")) return deny();
    } catch {
      return deny();
    }
  }
  return NextResponse.next();
}

function deny() {
  return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
}

export const config = { matcher: "/api/:path*" };
