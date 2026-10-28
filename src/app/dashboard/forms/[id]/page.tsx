import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { loadOwnedForm } from "@/lib/forms";
import { isUuid } from "@/lib/validate";
import FormEditor, { type Tab } from "@/components/FormEditor";

export const dynamic = "force-dynamic";
const TABS: Tab[] = ["build", "preview", "responses", "analytics", "integrations", "share"];

export default async function EditPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isUuid(params.id)) notFound();
  const form = await loadOwnedForm(params.id, user.id);
  if (!form) notFound();
  const tab = TABS.find((t) => t === searchParams.tab) ?? "build";
  return <FormEditor initial={JSON.parse(JSON.stringify(form))} initialTab={tab} />;
}
