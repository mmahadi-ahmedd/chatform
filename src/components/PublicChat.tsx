"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatBot, { type ChatConfig, type UploadFn } from "./ChatBot";
import { uuid } from "@/lib/uuid";

/** Chat connected to the real API: records views/starts, uploads files, submits answers. */
export default function PublicChat({ slug, config, embedded = false, inline = false }: { slug: string; config: ChatConfig; embedded?: boolean; inline?: boolean }) {
  const [inFrame, setInFrame] = useState(false);
  const sid = useRef(uuid());
  useEffect(() => setInFrame(embedded && !inline && window.parent !== window), [embedded, inline]);

  const beacon = useCallback(
    (type: "view" | "start") => {
      fetch(`/api/public/forms/${slug}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, sid: sid.current }),
        keepalive: true,
      }).catch(() => {});
    },
    [slug]
  );
  useEffect(() => beacon("view"), [beacon]);

  const submit = useCallback(
    async (answers: Record<string, string>) => {
      try {
        const res = await fetch(`/api/public/forms/${slug}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, website: "" }),
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

  const upload: UploadFn = useMemo(
    () => async (questionId, file) => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("question_id", questionId);
        const res = await fetch(`/api/public/forms/${slug}/upload`, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        return res.ok ? { file_id: data.file_id, name: data.name } : { error: data.error || "Upload failed. Please try again." };
      } catch {
        return { error: "Network error while uploading. Please try again." };
      }
    },
    [slug]
  );

  return (
    <ChatBot
      config={config}
      onSubmit={submit}
      uploadFile={upload}
      onStart={() => beacon("start")}
      onClose={inFrame ? () => window.parent.postMessage({ type: "chatform:close" }, "*") : undefined}
    />
  );
}
