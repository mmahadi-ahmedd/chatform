"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Avatar } from "../ChatBot";
import type { Draft } from "./model";

interface Preset {
  id: string;
  name: string;
  primary_color: string;
  avatar: string;
  position: "left" | "right";
  welcome_message: string;
  completion_message: string;
}

const SWATCHES = ["#2a3fd6", "#0f766e", "#b91c1c", "#c2410c", "#7c3aed", "#111827"];
const EMOJI = ["💬", "🤖", "👋", "🙂", "📝", "🎧", "⭐", "🚀"];

export default function DesignPanel({
  d, set, push,
}: {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  push: (kind: "success" | "error", text: string) => void;
}) {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const r = await api<Preset[]>("/api/presets");
    setPresets(r.ok ? r.data : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function savePreset() {
    const r = await api<Preset>("/api/presets", {
      method: "POST",
      json: { name, primary_color: d.color, avatar: d.avatar, position: d.position, welcome_message: d.welcome, completion_message: d.completion },
    });
    if (r.ok) { setName(""); setPresets((p) => [r.data, ...(p ?? [])]); push("success", "Design preset saved"); }
    else push("error", r.error!);
  }
  async function removePreset(id: string) {
    const r = await api(`/api/presets/${id}`, { method: "DELETE" });
    if (r.ok) setPresets((p) => (p ?? []).filter((x) => x.id !== id));
    else push("error", r.error!);
  }
  function apply(p: Preset) {
    set("color", p.primary_color); set("avatar", p.avatar); set("position", p.position);
    set("welcome", p.welcome_message); set("completion", p.completion_message);
    push("success", `Applied "${p.name}"`);
  }

  return (
    <div className="card space-y-4 p-4">
      <h2 className="font-semibold">Chatbot appearance</h2>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Welcome message</span>
        <textarea className="input" rows={2} maxLength={300} value={d.welcome} onChange={(e) => set("welcome", e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Success message (shown when finished)</span>
        <textarea className="input" rows={2} maxLength={300} value={d.completion} onChange={(e) => set("completion", e.target.value)} />
      </label>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Brand color</legend>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => set("color", c)} aria-label={`Use color ${c}`} aria-pressed={d.color === c}
              className={`h-7 w-7 rounded-full border-2 ${d.color === c ? "border-gray-900" : "border-white shadow"}`} style={{ background: c }} />
          ))}
          <input type="color" value={d.color} onChange={(e) => set("color", e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-gray-300" aria-label="Custom brand color" />
          <code className="text-xs text-gray-500">{d.color}</code>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Avatar</legend>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full" style={{ background: d.color, color: "#fff" }}><Avatar avatar={d.avatar} size={36} /></span>
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => set("avatar", e)} aria-label={`Use avatar ${e}`} aria-pressed={d.avatar === e}
              className={`h-8 w-8 rounded-full border text-lg leading-none ${d.avatar === e ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-white"}`}>{e}</button>
          ))}
        </div>
        <input className="input mt-2" maxLength={300} value={d.avatar} onChange={(e) => set("avatar", e.target.value)} aria-label="Custom avatar: emoji or https image URL" placeholder="Emoji or https://…/logo.png" />
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Widget position</legend>
        <div className="flex gap-4 text-sm">
          {(["left", "right"] as const).map((p) => (
            <label key={p} className="flex items-center gap-2">
              <input type="radio" name="position" checked={d.position === p} onChange={() => set("position", p)} className="accent-indigo-600" />
              Bottom {p}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold">Saved designs</h3>
        <p className="text-xs text-gray-500">Reuse colors, avatar, position and messages on other forms.</p>
        <div className="mt-2 flex gap-2">
          <input className="input" aria-label="Preset name" placeholder="Preset name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={savePreset} disabled={!name.trim()} className="btn btn-ghost shrink-0">Save</button>
        </div>
        {presets === null ? <p className="mt-2 text-xs text-gray-500">Loading…</p> : presets.length === 0 ? <p className="mt-2 text-xs text-gray-400">No saved designs yet.</p> : (
          <ul className="mt-2 space-y-1">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: p.primary_color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <button onClick={() => apply(p)} className="text-indigo-600 hover:underline">Apply</button>
                <button onClick={() => removePreset(p.id)} className="text-red-600 hover:underline" aria-label={`Delete preset ${p.name}`}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
