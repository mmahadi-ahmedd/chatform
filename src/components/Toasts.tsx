"use client";

import { useCallback, useRef, useState } from "react";

interface Toast {
  id: number;
  kind: "success" | "error";
  text: string;
}

/** Tiny toast system: `const { push, node } = useToasts()` then render `{node}` once. */
export function useToasts() {
  const [list, setList] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = next.current++;
    setList((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);
  const node = (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-md rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${t.kind === "success" ? "bg-gray-900 text-white" : "bg-red-600 text-white"}`}
        >
          {t.kind === "success" ? "✓ " : "⚠ "}
          {t.text}
        </div>
      ))}
    </div>
  );
  return { push, node };
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-gray-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" aria-hidden="true" />
      {label}…
    </span>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card animate-pulse space-y-2 p-4">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="h-3 w-2/3 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-4xl" aria-hidden="true">{icon}</p>
      <p className="mt-2 font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-gray-500">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
      <p>{message}</p>
      {onRetry && <button onClick={onRetry} className="btn btn-ghost mt-3">Try again</button>}
    </div>
  );
}
