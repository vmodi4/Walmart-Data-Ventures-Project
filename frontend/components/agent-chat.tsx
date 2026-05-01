"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, Send, User, Bot } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserMessage {
  role: "user"
  text: string
}

interface AgentMessage {
  role: "agent"
  text: string
}

type Message = UserMessage | AgentMessage

// ── Suggested prompts ──────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "Which categories missed forecast?",
  "Who are my top performers?",
  "How is regional performance trending?",
  "Where are my margin opportunities?",
]

// ── Main component ─────────────────────────────────────────────────────────────

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text }])
    setLoading(true)

    try {
      const response = await api.askAgent(text)
      setMessages((prev) => [...prev, { role: "agent", text: response.answer }])
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error"
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: `The agent couldn't reach the backend (${detail}). Make sure the FastAPI server is running on the configured base URL.` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <Card className="overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-6 py-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: "#6366F1" }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-midnight leading-tight">AI Insights Agent</h3>
          <p className="text-xs text-slate leading-tight">
            Ask questions about your data and get text-based insights instantly
          </p>
        </div>
      </div>

      {/* Conversation */}
      <ScrollArea className="h-[420px] px-6 py-5">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-8">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(99, 102, 241, 0.1)" }}
            >
              <Sparkles className="h-5 w-5 text-indigo" />
            </div>
            <div className="max-w-md text-center">
              <p className="text-sm font-medium text-midnight">
                Ask anything about your supplier data
              </p>
              <p className="mt-1 text-xs text-slate leading-relaxed">
                Get AI-generated insights on revenue, margin, forecast accuracy, regional trends, and more.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-midnight transition-colors hover:border-indigo hover:text-indigo"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex items-start gap-3 justify-end">
                  <div
                    className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5"
                    style={{ backgroundColor: "#6366F1" }}
                  >
                    <p className="text-sm leading-relaxed text-white">{msg.text}</p>
                  </div>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-slate" />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "#6366F1" }}
                  >
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                    <p className="text-sm leading-relaxed text-midnight">{msg.text}</p>
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="flex items-start gap-3">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#6366F1" }}
                >
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                  <Spinner className="h-3.5 w-3.5 text-indigo" />
                  <span className="text-xs text-slate">Analyzing your data...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 transition-colors focus-within:border-indigo">
          <input
            className="flex-1 bg-transparent text-sm text-midnight placeholder:text-slate outline-none"
            placeholder="Ask a question about your supplier data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage(input)
            }}
            disabled={loading}
            aria-label="Message the AI agent"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#6366F1" }}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate">
          Insights are generated from your dashboard data. Press Enter to send.
        </p>
      </div>
    </Card>
  )
}
