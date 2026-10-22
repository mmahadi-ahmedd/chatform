import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { loadForm } from "@/lib/forms";
import FormEditor from "@/components/FormEditor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const form = await loadForm("id", params.id, user.id);
  if (!form) notFound();
  return <FormEditor initial={form} initialTab={searchParams.tab === "responses" ? "responses" : "build"} />;
}
