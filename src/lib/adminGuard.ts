import { notFound, redirect } from "next/navigation";
import { getUser } from "./auth";

/** Role-based access for admin pages: signed-out -> login, signed-in non-admin -> 404 (existence isn't revealed). */
export async function requireAdminPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") notFound();
  return user;
}
