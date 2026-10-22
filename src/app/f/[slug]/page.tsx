import { loadForm } from "@/lib/forms";
import PublicChat from "@/components/PublicChat";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }: { params: { slug: string } }) {
  const form = await loadForm("slug", params.slug);
  if (!form || !form.published) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-center">
        <div>
          <p className="text-4xl">🔒</p>
          <h1 className="mt-2 text-lg font-semibold">This form isn&apos;t available</h1>
          <p className="mt-1 text-sm text-gray-500">It may have been unpublished or the link is wrong.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gray-100 sm:p-6">
      <div className="h-[100dvh] w-full overflow-hidden bg-white shadow-xl sm:h-[640px] sm:max-w-md sm:rounded-2xl">
        <PublicChat slug={form.slug} config={form} />
      </div>
    </main>
  );
}
