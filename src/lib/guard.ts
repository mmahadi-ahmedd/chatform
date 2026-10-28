import { getUser, type SessionUser } from "./auth";
import { err } from "./http";
import { ownsForm } from "./forms";
import { isUuid } from "./validate";

/**
 * Single choke point for "this route needs a signed-in owner of form :id".
 * Foreign or unknown forms both return 404 so ids can't be probed.
 */
export async function guardForm(id: string): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getUser();
  if (!user) return { response: err("Please sign in.", 401) };
  if (!isUuid(id) || !(await ownsForm(id, user.id))) return { response: err("Not found", 404) };
  return { user };
}
