import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";
export default async function Page() {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
