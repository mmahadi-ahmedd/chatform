import Link from "next/link";

const tabs = [
  { href: "/admin", label: "Overview", key: "overview" },
  { href: "/admin/users", label: "Users", key: "users" },
  { href: "/admin/activity", label: "Activity & errors", key: "activity" },
];

export default function AdminShell({ active, email, children }: { active: string; email: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="font-display text-xl font-extrabold text-indigo-600">ChatForm</Link>
            <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="hidden sm:inline">{email}</span>
            <Link href="/dashboard" className="btn btn-ghost">← My dashboard</Link>
          </div>
        </div>
        <nav aria-label="Admin sections" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${active === t.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{t.label}</Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
