import { loadPublicForm } from "@/lib/forms";
import PublicChat from "@/components/PublicChat";

export const dynamic = "force-dynamic";

export default async function WidgetPage({ params, searchParams }: { params: { slug: string }; searchParams: { inline?: string } }) {
  const form = await loadPublicForm(params.slug);
  if (!form) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white p-6 text-center text-sm text-gray-500">
        This chat is not available right now.
      </div>
    );
  }
  return (
    <div className="h-[100dvh] w-full">
      <PublicChat slug={form.slug} config={form} embedded inline={searchParams.inline === "1"} />
    </div>
  );
}
