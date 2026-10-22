"use client";

import { useCallback, useEffect, useState } from "react";
import ChatBot, { type ChatConfig } from "./ChatBot";

/** Chat connected to the real API. `embedded` = running inside the floating-widget iframe. */
export default function PublicChat({ slug, config, embedded = false }: { slug: string; config: ChatConfig; embedded?: boolean }) {
  const [inFrame, setInFrame] = useState(false);
  useEffect(() => setInFrame(embedded && window.parent !== window), [embedded]);

  const submit = useCallback(
    async (answers: Record<string, string>) => {
      try {
        const res = await fetch(`/api/public/forms/${slug}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        if (res.ok) return null;
        const data = await res.json().catch(() => ({}));
        return data.error || "Something went wrong. Please try again.";
      } catch {
        return "Network error. Please check your connection and try again.";
      }
    },
    [slug]
  );

  return (
    <ChatBot
      config={config}
      onSubmit={submit}
      onClose={inFrame ? () => window.parent.postMessage({ type: "chatform:close" }, "*") : undefined}
    />
  );
}
