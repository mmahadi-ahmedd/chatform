import { loadForm } from "@/lib/forms";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const form = await loadForm("slug", params.slug);
  const cors = { "Access-Control-Allow-Origin": "*" };
  if (!form || !form.published) return NextResponse.json({ error: "This form is not available." }, { status: 404, headers: cors });
  const { id, ...rest } = form;
  return NextResponse.json(rest, { headers: cors });
}
