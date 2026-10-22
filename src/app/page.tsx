import Link from "next/link";
import { getUser } from "@/lib/auth";
import DemoWidget from "@/components/DemoWidget";

export const dynamic = "force-dynamic";

const features = [
  { icon: "🧩", title: "Drag-free form builder", text: "Add text, email, multiple-choice and yes/no questions. Reorder, edit and mark questions required in seconds." },
  { icon: "💬", title: "Chat-style experience", text: "Questions appear one at a time in a friendly conversation — people finish more forms." },
  { icon: "🔌", title: "Embed anywhere", text: "Copy one JavaScript snippet and a floating chatbot appears on your website, desktop and mobile." },
  { icon: "🎨", title: "Your brand", text: "Pick your color and write your own welcome and thank-you messages." },
  { icon: "✅", title: "Built-in validation", text: "Email checks, required questions and choice validation on both the browser and the server." },
  { icon: "📊", title: "Simple dashboard", text: "See every submission with its timestamp, plus totals for forms and responses." },
];

const steps = [
  { n: 1, title: "Create a form", text: "Add your questions in the builder and preview the chat." },
  { n: 2, title: "Publish it", text: "Get a unique public link instantly. Unpublish any time." },
  { n: 3, title: "Embed the widget", text: "Paste a one-line script on any website." },
  { n: 4, title: "Collect responses", text: "View every submission in your dashboard." },
];

export default async function Landing() {
  const user = await getUser();
  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-indigo-600">💬 ChatForm</Link>
          <nav className="hidden gap-6 text-sm text-gray-600 sm:flex">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#how" className="hover:text-gray-900">How it works</a>
            <a href="#demo" className="hover:text-gray-900">Demo</a>
          </nav>
          <div className="flex gap-2">
            {user ? (
              <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">Log in</Link>
                <Link href="/signup" className="btn btn-primary">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">Forms, but conversational</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">Turn boring forms into <span className="text-indigo-600">friendly chats</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            Build a form in minutes, embed a chatbot widget on your website with one line of code, and collect responses in a simple dashboard.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={user ? "/dashboard" : "/signup"} className="btn btn-primary !px-6 !py-3 !text-base">Get started free</Link>
            <a href="#demo" className="btn btn-ghost !px-6 !py-3 !text-base">Try the live demo</a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Everything you need, nothing you don&apos;t</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-16 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{s.n}</span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="demo" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Try the chatbot widget</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">This is exactly what your visitors see on your website. Go ahead and answer the questions — nothing is saved in the demo.</p>
        <div className="mt-8"><DemoWidget /></div>
      </section>

      <section className="bg-indigo-600 py-14 text-center text-white">
        <h2 className="text-3xl font-bold">Ready to build your first chat form?</h2>
        <Link href={user ? "/dashboard" : "/signup"} className="btn mt-6 bg-white !px-6 !py-3 !text-base text-indigo-700 hover:bg-indigo-50">Create your free account</Link>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-gray-600 sm:flex-row">
          <span className="font-bold text-indigo-600">💬 ChatForm</span>
          <nav className="flex flex-wrap justify-center gap-5">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#how" className="hover:text-gray-900">How it works</a>
            <a href="#demo" className="hover:text-gray-900">Demo</a>
            <Link href="/login" className="hover:text-gray-900">Log in</Link>
            <Link href="/signup" className="hover:text-gray-900">Sign up</Link>
          </nav>
          <div className="flex gap-4">
            <a href="mailto:hello@example.com" className="hover:text-gray-900">hello@example.com</a>
            <a href="https://github.com/" target="_blank" rel="noreferrer" className="hover:text-gray-900">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
