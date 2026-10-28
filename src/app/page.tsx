import Link from "next/link";
import { getUser } from "@/lib/auth";
import DemoWidget from "@/components/DemoWidget";

export const dynamic = "force-dynamic";

const SITE_URL = "https://chatform-five.vercel.app";
const GITHUB_URL = "https://github.com/mmahadi-ahmedd/chatform";

const questionTypes = [
  { name: "Short text", text: "Names, comments, anything people type." },
  { name: "Email", text: "Checked for a real-looking address before it is accepted." },
  { name: "Multiple choice", text: "Tappable buttons. Up to ten options." },
  { name: "Yes or no", text: "Two buttons, nothing to type." },
];

/** A visitor's question (yellow bubble) followed by the answer. */
function Ask({ q, id, children }: { q: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="ml-auto w-fit max-w-[92%] rounded-3xl rounded-br-md bg-sun px-6 py-3 font-display text-2xl font-bold text-ink sm:text-3xl">
        {q}
      </h2>
      <div className="mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-ink/80">{children}</div>
    </section>
  );
}

function Bubble({ from, delay, children }: { from: "bot" | "user"; delay: number; children: React.ReactNode }) {
  return (
    <p
      className={`pop w-fit max-w-[85%] px-5 py-3 text-lg font-medium ${
        from === "bot"
          ? "rounded-3xl rounded-bl-md bg-white text-ink"
          : "ml-auto rounded-3xl rounded-br-md bg-sun text-ink"
      }`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </p>
  );
}

export default async function Landing() {
  const user = await getUser();
  const start = user ? "/dashboard" : "/signup";

  return (
    <div className="bg-white font-sans text-ink">
      <div className="bg-cobalt-600 text-white">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">ChatForm</Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <a href="#features" className="hidden hover:underline sm:inline">What it does</a>
            <a href="#how" className="hidden hover:underline sm:inline">How it works</a>
            <a href="#demo" className="hidden hover:underline sm:inline">Try it</a>
            {user ? (
              <Link href="/dashboard" className="rounded-full bg-white px-4 py-2 font-semibold text-cobalt-700 hover:bg-cobalt-50">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="hover:underline">Log in</Link>
                <Link href="/signup" className="rounded-full bg-white px-4 py-2 font-semibold text-cobalt-700 hover:bg-cobalt-50">Sign up</Link>
              </>
            )}
          </nav>
        </header>

        <section className="mx-auto grid max-w-5xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28 lg:pt-16">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">Ask one question at a time.</h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/85">
              ChatForm turns your form into a small chat on your website. Visitors answer, you read the replies in a dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={start} className="rounded-full bg-sun px-6 py-3 text-base font-bold text-ink hover:brightness-95">Make your first form</Link>
              <a href="#demo" className="text-base font-semibold underline underline-offset-4 hover:no-underline">Try the chat first</a>
            </div>
          </div>

          <div aria-hidden="true" className="space-y-3">
            <Bubble from="bot" delay={0.3}>Hi! What should we call you?</Bubble>
            <Bubble from="user" delay={1.1}>Sam</Bubble>
            <Bubble from="bot" delay={1.9}>Nice to meet you, Sam. What&apos;s your email?</Bubble>
            <Bubble from="user" delay={2.7}>sam@example.com</Bubble>
            <Bubble from="bot" delay={3.5}>Thanks. That&apos;s everything I needed.</Bubble>
          </div>
        </section>
      </div>

      <main className="mx-auto max-w-4xl space-y-24 px-5 py-20">
        <Ask q="What is this?">
          <p>
            A form builder where the form shows up as a chat window. You write the questions, and visitors get them one at a time, like
            texting. Use it for a contact form, a booking request, feedback after an event, or a newsletter sign-up.
          </p>
        </Ask>

        <Ask q="What can I ask?" id="features">
          <dl className="divide-y divide-ink/10 border-y border-ink/10">
            {questionTypes.map((t) => (
              <div key={t.name} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
                <dt className="font-display text-xl font-bold text-ink">{t.name}</dt>
                <dd>{t.text}</dd>
              </div>
            ))}
          </dl>
          <p>
            Mark any question as required, drag them into a new order, and preview the whole chat before you publish. Answers are checked in
            the browser and again on the server.
          </p>
        </Ask>

        <Ask q="Will it match my site?">
          <p>
            Pick a color and write your own welcome and thank-you messages. The chat sits in a corner of your page inside its own frame, so
            it never touches your styles.
          </p>
        </Ask>

        <Ask q="How do I put it on my site?" id="how">
          <ol className="space-y-5">
            <li className="flex gap-4">
              <span className="w-8 shrink-0 font-display text-4xl font-extrabold leading-none text-cobalt-600">1</span>
              <span>Build your questions in the editor and press Publish.</span>
            </li>
            <li className="flex gap-4">
              <span className="w-8 shrink-0 font-display text-4xl font-extrabold leading-none text-cobalt-600">2</span>
              <span>Open the Share tab and copy your snippet.</span>
            </li>
            <li className="flex gap-4">
              <span className="w-8 shrink-0 font-display text-4xl font-extrabold leading-none text-cobalt-600">3</span>
              <div className="min-w-0 flex-1">
                <p>Paste it just before the closing body tag of your page.</p>
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-4 text-sm leading-relaxed text-white/90">
                  <code>{`<script src="${SITE_URL}/embed.js"\n        data-form="your-form-id" async></script>`}</code>
                </pre>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="w-8 shrink-0 font-display text-4xl font-extrabold leading-none text-cobalt-600">4</span>
              <span>Replies land in your dashboard, each with the time it was sent.</span>
            </li>
          </ol>
          <p>No website? Every form also gets its own link you can send to people.</p>
        </Ask>

        <Ask q="Does it work on phones?">
          <p>Yes. On a small screen the chat opens full screen, and the answer buttons are big enough to tap.</p>
        </Ask>

        <Ask q="Can I try it?" id="demo">
          <p>This is the real widget on a pretend website. Answer the questions; nothing is saved here.</p>
        </Ask>
        <div className="-mt-12"><DemoWidget /></div>
      </main>

      <section className="bg-cobalt-600 text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-6 px-5 py-14">
          <div>
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Build your first form.</h2>
            <p className="mt-2 text-white/85">It takes a few minutes, and you can unpublish it any time.</p>
          </div>
          <Link href={start} className="rounded-full bg-sun px-6 py-3 text-base font-bold text-ink hover:brightness-95">
            {user ? "Go to dashboard" : "Create an account"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-ink/70 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-lg font-extrabold text-ink">ChatForm</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="#features" className="hover:text-ink hover:underline">What it does</a>
            <a href="#how" className="hover:text-ink hover:underline">How it works</a>
            <a href="#demo" className="hover:text-ink hover:underline">Try it</a>
            <Link href="/login" className="hover:text-ink hover:underline">Log in</Link>
            <Link href="/signup" className="hover:text-ink hover:underline">Sign up</Link>
          </nav>
          <div className="flex gap-5">
            <a href={SITE_URL} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">chatform-five.vercel.app</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
