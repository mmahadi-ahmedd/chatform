"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/types";
import { visibleQuestions } from "@/lib/logic";
import { validateAnswer } from "@/lib/validate";

export interface ChatConfig {
  title: string;
  welcome_message: string;
  completion_message: string;
  primary_color: string;
  avatar?: string;
  questions: Pick<Question, "id" | "type" | "label" | "required" | "options" | "config" | "logic">[];
}

export type UploadFn = (questionId: string, file: File) => Promise<{ file_id: string; name: string } | { error: string }>;

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

export function Avatar({ avatar, size = 36 }: { avatar?: string; size?: number }) {
  const a = avatar || "💬";
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/30 leading-none"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden="true"
    >
      {a.startsWith("https://") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        a
      )}
    </span>
  );
}

/**
 * Chat-style form. `onSubmit` resolves to an error message on failure, or null on success.
 * Questions are asked one at a time; conditional logic decides which ones appear.
 */
export default function ChatBot({
  config,
  onSubmit,
  onClose,
  onStart,
  uploadFile,
  autoFocus = true,
}: {
  config: ChatConfig;
  onSubmit: (answers: Record<string, string>) => Promise<string | null>;
  onClose?: () => void;
  onStart?: () => void;
  uploadFile?: UploadFn;
  autoFocus?: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [idx, setIdx] = useState(-1);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [hover, setHover] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const answers = useRef<Record<string, string>>({});
  const started = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const color = config.primary_color;
  const fg = textColorFor(color);
  const qs = config.questions;
  const current = idx >= 0 && idx < qs.length && !done ? qs[idx] : null;
  const visible = visibleQuestions(qs, answers.current);
  const pos = current ? visible.findIndex((q) => q.id === current.id) + 1 : 0;
  const progress = done ? 1 : current && visible.length ? (pos - 1) / visible.length : 0;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const nextIndex = useCallback(
    (after: number) => {
      const shown = new Set(visibleQuestions(qs, answers.current).map((q) => q.id));
      for (let j = after + 1; j < qs.length; j++) if (shown.has(qs[j].id)) return j;
      return -1;
    },
    [qs]
  );

  const ask = useCallback(
    (j: number, delay = 500) => {
      setTyping(true);
      later(() => {
        setTyping(false);
        setMsgs((m) => [...m, { from: "bot", text: qs[j].label }]);
        setIdx(j);
        setInput("");
        setHover(0);
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qs]
  );

  const finish = useCallback(async () => {
    setBusy(true);
    setError(null);
    const err = await onSubmit(answers.current);
    setBusy(false);
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
    started.current = false;
    setMsgs([{ from: "bot", text: config.welcome_message }]);
    setIdx(-1);
    setDone(false);
    setError(null);
    setInput("");
    setBusy(false);
    setTyping(false);
    const first = (() => {
      const shown = new Set(visibleQuestions(qs, {}).map((q) => q.id));
      return qs.findIndex((q) => shown.has(q.id));
    })();
    if (first >= 0) ask(first, 900);
    else setDone(true);
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
    if (autoFocus && current) inputRef.current?.focus({ preventScroll: true });
  }, [current, autoFocus]);

  /** Records an answer (already validated) and moves on. */
  function commit(value: string, display: string) {
    if (!current) return;
    if (!started.current) {
      started.current = true;
      onStart?.();
    }
    setError(null);
    answers.current[current.id] = value;
    setMsgs((m) => [...m, { from: "user", text: display || "Skipped" }]);
    const next = nextIndex(idx);
    if (next >= 0) ask(next);
    else finish();
  }

  function answer(value: string, display?: string) {
    if (!current || busy) return;
    const v = value.trim();
    const problem = validateAnswer(current, v);
    if (problem) {
      setError(problem);
      return;
    }
    commit(v, display ?? (current.type === "rating" && v ? `${"★".repeat(Number(v))} (${v}/${current.config.max ?? 5})` : v));
  }

  async function pickFile(file: File | undefined) {
    if (!file || !current) return;
    if (file.size > MAX_UPLOAD_BYTES) return setError("File is too large (max 2 MB).");
    if (!(file.type in ALLOWED_UPLOAD_TYPES)) return setError("Unsupported file type. Use PNG, JPG, GIF, WebP, PDF, TXT or CSV.");
    setError(null);
    if (!uploadFile) return commit("preview-file", file.name); // preview/demo: nothing is uploaded
    setBusy(true);
    const res = await uploadFile(current.id, file);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    commit(res.file_id, res.name);
  }

  const lastAsked = done ? null : current;
  const showRetry = !current && !done && !typing && !!error && idx >= 0;
  const canType = !!lastAsked && !typing && !busy;
  const max = current?.config.max ?? 5;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white text-gray-900">
      <div style={{ background: color, color: fg }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar avatar={config.avatar} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{config.title || "Chat"}</div>
            <div className="text-xs opacity-80" aria-live="polite">
              {done ? "All done" : current ? `Question ${pos} of ${visible.length}` : "Getting started…"}
            </div>
          </div>
          <button onClick={reset} aria-label="Restart conversation" title="Restart" className="rounded-full p-2 text-lg leading-none hover:bg-white/20">
            ↻
          </button>
          {onClose && (
            <button onClick={onClose} aria-label="Close chat" className="rounded-full p-2 text-xl leading-none hover:bg-white/20">
              ✕
            </button>
          )}
        </div>
        <div className="h-1 bg-black/15" role="progressbar" aria-label="Conversation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%`, background: fg === "#ffffff" ? "#fff" : "#111827" }} />
        </div>
      </div>

      <div ref={scroller} role="log" aria-label="Conversation" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto bg-gray-50 px-3 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={`msg-in flex items-end gap-2 ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            {m.from === "bot" && (
              <span style={{ background: color, color: fg }} className="rounded-full">
                <Avatar avatar={config.avatar} size={28} />
              </span>
            )}
            <div
              className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm"
              style={m.from === "user" ? { background: color, color: fg, borderBottomRightRadius: 4 } : { background: "#fff", border: "1px solid #e5e7eb", borderBottomLeftRadius: 4 }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex items-end gap-2" aria-label="Typing">
            <span style={{ background: color, color: fg }} className="rounded-full"><Avatar avatar={config.avatar} size={28} /></span>
            <div className="flex gap-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        {done && (
          <div className="flex justify-center pt-2">
            <button onClick={reset} className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
              ↻ Start over
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
        {showRetry && (
          <button onClick={finish} disabled={busy} className="w-full rounded-full px-4 py-2.5 text-sm font-medium" style={{ background: color, color: fg }}>
            {busy ? "Sending…" : "Try again"}
          </button>
        )}
        {busy && !error && <p className="text-center text-xs text-gray-500" role="status">{current?.type === "file" ? "Uploading…" : "Sending your answers…"}</p>}

        {canType && lastAsked && (lastAsked.type === "text" || lastAsked.type === "email") && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); answer(input); }} className="flex gap-2">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={lastAsked.type === "email" ? "email" : "text"}
              inputMode={lastAsked.type === "email" ? "email" : undefined}
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(null); }}
              placeholder={lastAsked.type === "email" ? "you@example.com" : "Type your answer…"}
              maxLength={lastAsked.config.max_length ?? 2000}
              className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2 text-base outline-none focus:border-gray-500 sm:text-sm"
              aria-label={lastAsked.label}
            />
            <SendButton color={color} fg={fg} />
          </form>
        )}
        {canType && lastAsked?.type === "date" && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); answer(input); }} className="flex gap-2">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="date"
              value={input}
              min={lastAsked.config.min_date}
              max={lastAsked.config.max_date}
              onChange={(e) => { setInput(e.target.value); setError(null); }}
              className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2 text-base outline-none focus:border-gray-500 sm:text-sm"
              aria-label={lastAsked.label}
            />
            <SendButton color={color} fg={fg} />
          </form>
        )}
        {canType && lastAsked?.type === "dropdown" && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); answer(input); }} className="flex gap-2">
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(null); }}
              className="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-base outline-none focus:border-gray-500 sm:text-sm"
              aria-label={lastAsked.label}
            >
              <option value="">Choose an option…</option>
              {lastAsked.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <SendButton color={color} fg={fg} />
          </form>
        )}
        {canType && lastAsked?.type === "yesno" && (
          <div className="flex flex-wrap gap-2">
            {["Yes", "No"].map((o) => <ChoiceButton key={o} label={o} color={color} onClick={() => answer(o)} />)}
          </div>
        )}
        {canType && lastAsked?.type === "choice" && (
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {lastAsked.options.map((o) => <ChoiceButton key={o} label={o} color={color} onClick={() => answer(o)} />)}
          </div>
        )}
        {canType && lastAsked?.type === "rating" && (
          <div className="flex flex-wrap items-center gap-1" onMouseLeave={() => setHover(0)}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => answer(String(n))}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                aria-label={`Rate ${n} out of ${max}`}
                className="rounded-full p-1 text-3xl leading-none transition-transform hover:scale-110 active:scale-95"
                style={{ color: n <= hover ? color : "#d1d5db" }}
              >
                ★
              </button>
            ))}
          </div>
        )}
        {canType && lastAsked?.type === "file" && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-dashed px-4 py-2.5 text-sm font-medium focus-within:ring-2" style={{ borderColor: color, color }}>
            📎 Choose a file (max 2 MB)
            <input type="file" className="sr-only" aria-label={lastAsked.label} accept={Object.keys(ALLOWED_UPLOAD_TYPES).join(",")} onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        {canType && lastAsked && !lastAsked.required && (
          <button onClick={() => answer("")} className="mt-2 w-full text-center text-xs text-gray-500 underline">
            Skip this question
          </button>
        )}
        {done && <p className="text-center text-xs text-gray-400">Conversation finished</p>}
      </div>
    </div>
  );
}

function SendButton({ color, fg }: { color: string; fg: string }) {
  return (
    <button type="submit" className="rounded-full px-4 py-2 text-sm font-medium transition active:scale-95" style={{ background: color, color: fg }}>
      Send
    </button>
  );
}

function ChoiceButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border-2 bg-white px-4 py-2 text-sm font-medium transition active:scale-95"
      style={{ borderColor: color, color }}
      onMouseEnter={(e) => { e.currentTarget.style.background = color; e.currentTarget.style.color = textColorFor(color); }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = color; }}
    >
      {label}
    </button>
  );
}
