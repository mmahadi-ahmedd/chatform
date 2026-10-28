"use client";

import { useCallback, useMemo, useState } from "react";
import ChatBot, { Avatar, type ChatConfig } from "../ChatBot";
import type { Draft } from "./model";
import { hasOptions, toOptions } from "./model";

type Mode = "floating" | "mobile" | "inline";

export default function PreviewTab({ d }: { d: Draft }) {
  const [mode, setMode] = useState<Mode>("floating");
  const config: ChatConfig = useMemo(
    () => ({
      title: d.title || "Untitled form",
      welcome_message: d.welcome,
      completion_message: d.completion,
      primary_color: d.color,
      avatar: d.avatar,
      questions: d.questions.map((q) => ({
        id: q.id, type: q.type, label: q.label || "(empty question)", required: q.required,
        options: hasOptions(q.type) ? toOptions(q.optionsText) : [], config: q.config, logic: q.logic,
      })),
    }),
    [d]
  );
  const noop = useCallback(async () => null, []);
  const side = d.position === "left" ? "left-4" : "right-4";
  const modes: [Mode, string][] = [["floating", "Floating widget"], ["mobile", "Mobile"], ["inline", "Inline"]];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Preview mode" className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
          {modes.map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 font-medium ${mode === m ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{label}</button>
          ))}
        </div>
        <p className="text-xs text-gray-500">Preview only: answers aren&apos;t saved. Conditions, validation and progress work exactly like the live chat.</p>
      </div>

      {mode === "floating" && (
        <div className="relative mx-auto h-[640px] max-w-3xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow">
          <div className="space-y-3 p-6" aria-hidden="true">
            <div className="h-6 w-1/3 rounded bg-gray-200" /><div className="h-3 w-full rounded bg-gray-100" /><div className="h-3 w-5/6 rounded bg-gray-100" /><div className="mt-4 h-24 rounded bg-gray-100" />
          </div>
          <div className={`absolute bottom-20 top-4 w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-gray-200 shadow-2xl sm:w-[360px] ${side}`}>
            <ChatBot config={config} onSubmit={noop} autoFocus={false} />
          </div>
          <span className={`absolute bottom-4 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ${side}`} style={{ background: d.color }} aria-hidden="true"><Avatar avatar={d.avatar} size={32} /></span>
        </div>
      )}
      {mode === "mobile" && (
        <div className="mx-auto h-[640px] w-[375px] max-w-full overflow-hidden rounded-[2rem] border-8 border-gray-900 bg-white shadow-xl">
          <ChatBot config={config} onSubmit={noop} autoFocus={false} />
        </div>
      )}
      {mode === "inline" && (
        <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow">
          <h3 className="font-semibold">Your page content</h3>
          <p className="mt-1 text-sm text-gray-500">The chat sits right inside your page.</p>
          <div className="mt-4 h-[560px] overflow-hidden rounded-xl border border-gray-200">
            <ChatBot config={config} onSubmit={noop} autoFocus={false} />
          </div>
        </div>
      )}
    </div>
  );
}
