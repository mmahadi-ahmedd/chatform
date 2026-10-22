"use client";

import { useState } from "react";
import ChatBot, { type ChatConfig } from "./ChatBot";

const demo: ChatConfig = {
  title: "ChatForm Demo",
  welcome_message: "Hi there! 👋 This is a live demo of a ChatForm chatbot. Want to try it?",
  completion_message: "That's it — in a real form, your answers would now be saved to your dashboard. 🎉",
  primary_color: "#2a3fd6",
  questions: [
    { id: "d1", type: "text", label: "What's your name?", required: true, options: [] },
    { id: "d2", type: "email", label: "What's your email address?", required: true, options: [] },
    { id: "d3", type: "choice", label: "What would you use ChatForm for?", required: true, options: ["Lead capture", "Feedback", "Support", "Surveys"] },
    { id: "d4", type: "yesno", label: "Would you like to hear about updates?", required: false, options: [] },
  ],
};
const noop = async () => null;

/** A fake website with the floating widget, exactly how it looks once embedded. */
export default function DemoWidget() {
  const [open, setOpen] = useState(true);
  return (
    <div className="relative mx-auto h-[640px] max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-2">
        <span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-yellow-400" /><span className="h-3 w-3 rounded-full bg-green-400" />
        <span className="ml-3 truncate rounded bg-white px-3 py-0.5 text-xs text-gray-500">https://your-website.com</span>
      </div>
      <div className="space-y-3 p-6">
        <div className="h-6 w-1/3 rounded bg-gray-200" />
        <div className="h-3 w-full rounded bg-gray-100" /><div className="h-3 w-5/6 rounded bg-gray-100" /><div className="h-3 w-2/3 rounded bg-gray-100" />
        <div className="mt-6 h-28 rounded-lg bg-gray-100" />
      </div>
      {open && (
        <div className="absolute inset-x-3 bottom-20 top-16 overflow-hidden rounded-2xl border border-gray-200 shadow-2xl sm:inset-x-auto sm:right-5 sm:top-14 sm:w-[360px]">
          <ChatBot config={demo} onSubmit={noop} onClose={() => setOpen(false)} restartable autoFocus={false} />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl text-white shadow-lg transition hover:scale-105"
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}