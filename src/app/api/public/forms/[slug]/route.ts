import { NextResponse } from "next/server";
import { loadPublicForm } from "@/lib/forms";
import { route } from "@/lib/http";

// Read by embed.js on other websites (to get color / avatar / position), so CORS is open for this read-only endpoint.
const cors = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=30" };

export const GET = route<{ params: { slug: string } }>("public.form", async (_req, { params }) => {
  const form = await loadPublicForm(params.slug);
  if (!form) return NextResponse.json({ error: "This form is not available." }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  const { id, updated_at, ...rest } = form;
  return NextResponse.json(rest, { headers: cors });
});
