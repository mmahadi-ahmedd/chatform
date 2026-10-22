"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import { validateAnswer } from "@/lib/validate";

export interface ChatConfig {
  title: string;
  welcome_message: string;
  completion_message: string;
  primary_color: string;
  questions: Pick<Question, "id" | "type" | "label" | "required" | "options">[];
}

interface Msg {
  from: "bot" | "user";
  text: string;
}

function textColorFor(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#111827" : "#ffffff";
}

/**
 * Chat-style form. `onSubmit` returns an error message string on failure, or null on success.
 */
export default function ChatBot({
  config,
  onSubmit,
  onClose,
  restartable = false,
  autoFocus = true,
}: {
  config: ChatConfig;
  onSubmit: (answers: Record<string, string>) => Promise<string | null>;
  onClose?: () => void;
  restartable?: boolean;
  autoFocus?: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [idx, setIdx] = useState(-1);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const answers = useRef<Record<string, string>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const color = config.primary_color;
  const fg = textColorFor(color);
  const qs = config.questions;
  const current = idx >= 0 && idx < qs.length && !done ? qs[idx] : null;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const askQuestion = useCallback(
    (i: number) => {
      setTyping(true);
      later(() => {
        setTyping(false);
        setMsgs((m) => [...m, { from: "bot", text: qs[i].label }]);
        setIdx(i);
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qs]
  );

  const finish = useCallback(async () => {
    setSending(true);
    setError(null);
    const err = await onSubmit(answers.current);
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setTyping(true);
    later(() => {
      setTyping(false);
      setMsgs((m) => [...m, { from: "bot", text: config.completion_message }]);
      setDone(true);
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSubmit, config.completion_message]);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    answers.current = {};
    setMsgs([{ from: "bot", text: config.welcome_message }]);
    setIdx(-1);
    setDone(false);
    setError(null);
    setInput("");
    setSending(false);
    setTyping(false);
    if (qs.length) {
      setTyping(true);
      later(() => {
        setTyping(false);
        setMsgs((m) => [...m, { from: "bot", text: qs[0].label }]);
        setIdx(0);
      }, 900);
    } else {
      setDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.welcome_message, qs]);

  useEffect(() => {
    reset();
    return () => timers.current.forEach(clearTimeout);
  }, [reset]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, error, done]);

  useEffect(() => {
    if (autoFocus && current && (current.type === "text" || current.type === "email")) inputRef.current?.focus({ preventScroll: true });
  }, [current, autoFocus]);

  function answer(value: string) {
    if (!current || sending) return;
    const problem = validateAnswer(current, value);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const v = value.trim();
    answers.current[current.id] = v;
    setMsgs((m) => [...m, { from: "user", text: v || "Skipped" }]);
    setInput("");
    if (idx + 1 < qs.length) askQuestion(idx + 1);
    else finish();
  }

  const showFinalRetry = !current && !done && !typing && idx >= qs.length - 1 && qs.length > 0 && !!error;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white text-gray-900">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: color, color: fg }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-lg">💬</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{config.title || "Chat"}</div>
          <div className="text-xs opacity-80">We typically reply instantly</div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close chat" className="rounded-full p-2 text-xl leading-none hover:bg-white/20">
            ✕
          </button>
        )}
      </div>

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-gray-50 px-3 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm"
              style={
                m.from === "user"
                  ? { background: color, color: fg, borderBottomRightRadius: 4 }
                  : { background: "#fff", border: "1px solid #e5e7eb", borderBottomLeftRadius: 4 }
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm" aria-label="Typing">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        {done && restartable && (
          <div className="flex justify-center pt-2">
            <button onClick={reset} className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
              ↺ Restart
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white p-3">
        {error && (
          <p role="alert" data-chat-error className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {error}
          </p>
        )}
        {showFinalRetry && (
          <button onClick={finish} disabled={sending} className="w-full rounded-full px-4 py-2 text-sm font-medium" style={{ background: color, color: fg }}>
            {sending ? "Sending…" : "Try again"}
          </button>
        )}
        {sending && !error && <p className="text-center text-xs text-gray-500">Sending your answers…</p>}
        {current && !typing && !sending && (current.type === "text" || current.type === "email") && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              answer(input);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type={current.type === "email" ? "email" : "text"}
              inputMode={current.type === "email" ? "email" : undefined}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder={current.type === "email" ? "you@example.com" : "Type your answer…"}
              maxLength={2000}
              className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2 text-base outline-none focus:border-gray-500 sm:text-sm"
              aria-label={current.label}
            />
            <button type="submit" className="rounded-full px-4 py-2 text-sm font-medium" style={{ background: color, color: fg }}>
              Send
            </button>
          </form>
        )}
        {current && !typing && !sending && current.type === "yesno" && (
          <div className="flex flex-wrap gap-2">
            {["Yes", "No"].map((o) => (
              <ChoiceButton key={o} label={o} color={color} onClick={() => answer(o)} />
            ))}
          </div>
        )}
        {current && !typing && !sending && current.type === "choice" && (
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {current.options.map((o) => (
              <ChoiceButton key={o} label={o} color={color} onClick={() => answer(o)} />
            ))}
          </div>
        )}
        {current && !typing && !sending && !current.required && (
          <button onClick={() => answer("")} className="mt-2 w-full text-center text-xs text-gray-500 underline">
            Skip this question
          </button>
        )}
        {(done || (!current && !showFinalRetry && !sending)) && (
          <p className="text-center text-xs text-gray-400">{done ? "Conversation finished" : "…"}</p>
        )}
      </div>
    </div>
  );
}

function ChoiceButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border-2 bg-white px-4 py-1.5 text-sm font-medium transition hover:text-white"
      style={{ borderColor: color, color }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = color;
        e.currentTarget.style.color = textColorFor(color);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#fff";
        e.currentTarget.style.color = color;
      }}
    >
      {label}
    </button>
  );
}