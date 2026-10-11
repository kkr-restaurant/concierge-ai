"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

type Entry = { from: "user" | "bot"; text: string; context?: string };

/**
 * Real conversation with an agent via Workers AI. Conversation history is
 * held in the browser and re-sent each turn (the server is stateless) —
 * nothing here is stored.
 */
export default function AgentChat({
  agentId,
  agentName,
  agentAvatar
}: {
  agentId: string;
  agentName: string;
  agentAvatar: string;
}) {
  const [log, setLog] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;

    const history = log.map((e) => ({
      role: e.from === "user" ? ("user" as const) : ("assistant" as const),
      content: e.text
    }));

    setLog((l) => [...l, { from: "user", text: message }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/v1/tenants/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history })
      });

      if (!res.ok) {
        setLog((l) => [
          ...l,
          { from: "bot", text: "Something went wrong getting a response — try again." }
        ]);
        return;
      }

      const data = await res.json();
      const used: string[] = [];
      if (data.context?.knowledge_files_used > 0) {
        used.push(`${data.context.knowledge_files_used} knowledge file(s)`);
      }
      if (data.context?.active_rules_used > 0) {
        used.push(`${data.context.active_rules_used} rule(s)`);
      }
      setLog((l) => [
        ...l,
        {
          from: "bot",
          text: data.reply,
          context: used.length ? `Used: ${used.join(", ")}` : "Used: no knowledge or rules"
        }
      ]);
    } catch {
      setLog((l) => [
        ...l,
        { from: "bot", text: "Couldn't reach the server — check your connection." }
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-card p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{agentAvatar}</span>
        <span className="text-sm font-medium">{agentName}</span>
        <span className="text-xs text-success ml-auto">● live test</span>
      </div>

      <div className="bg-surface2 rounded-md p-3 mb-3 h-72 overflow-y-auto flex flex-col gap-2">
        {log.length === 0 && (
          <p className="text-xs text-muted text-center my-auto">
            Send a message to talk to {agentName}. This is a real model, not a script.
          </p>
        )}
        {log.map((e, i) => (
          <div
            key={i}
            className={`max-w-[85%] ${e.from === "user" ? "self-end" : "self-start"}`}
          >
            <div
              className={`text-sm px-3 py-2 rounded-md ${
                e.from === "user" ? "bg-brass/15 text-brass" : "bg-surface text-fg"
              }`}
            >
              {e.text}
            </div>
            {e.context && <p className="text-[10px] text-muted mt-0.5 px-1">{e.context}</p>}
          </div>
        ))}
        {sending && (
          <div className="text-sm px-3 py-2 rounded-md bg-surface text-muted self-start">…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={sending}
          placeholder="Type a message…"
          className="flex-1 bg-surface2 border border-border rounded-md px-3 py-2 text-sm disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={sending}
          aria-label="Send"
          className="bg-brass text-ink rounded-md px-3 disabled:opacity-60"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
