"use client";

import { useEffect, useState } from "react";

export default function ShareTab({ slug, published, dirty }: { slug: string; published: boolean; dirty: boolean }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/f/${slug}`;
  const floating = `<script src="${origin}/embed.js" data-form="${slug}" async></script>`;
  const inline = `<div id="my-chat"></div>\n<script src="${origin}/embed.js" data-form="${slug}"\n        data-mode="inline" data-target="#my-chat" data-height="600px" async></script>`;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!published && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This form is a draft. Publish it for the link and widget to work.</p>}
      {dirty && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Unsaved changes won&apos;t appear to visitors until you save.</p>}
      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">Public link</h2>
        <CopyRow text={url} />
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">Open in new tab ↗</a>
      </section>
      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">Floating widget</h2>
        <p className="text-sm text-gray-600">A chat button in the corner of every page. Paste before the closing <code>&lt;/body&gt;</code> tag.</p>
        <CopyRow text={floating} multiline />
        <p className="text-xs text-gray-500">Options: <code>data-position=&quot;left&quot;</code> overrides the position, <code>data-open=&quot;true&quot;</code> opens it on load, <code>data-teaser=&quot;false&quot;</code> hides the welcome bubble.</p>
      </section>
      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">Inline embed</h2>
        <p className="text-sm text-gray-600">Place the chat inside your page layout, in any container.</p>
        <CopyRow text={inline} multiline />
      </section>
    </div>
  );
}

export function CopyRow({ text, multiline }: { text: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text can be selected manually */
    }
  }
  return (
    <div className="flex items-start gap-2">
      <code className={`flex-1 rounded-lg bg-gray-100 px-3 py-2 text-xs ${multiline ? "whitespace-pre-wrap break-all" : "truncate"}`}>{text}</code>
      <button onClick={copy} className="btn btn-ghost shrink-0" aria-live="polite">{copied ? "Copied ✓" : "Copy"}</button>
    </div>
  );
}
