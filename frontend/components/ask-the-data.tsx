"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface ToolCall {
  tool: string
  args: Record<string, unknown>
}

interface AgentResponse {
  answer: string
  trace: ToolCall[]
  iterations: number
}

interface UserMessage {
  role: "user"
  text: string
}

interface AgentMessage {
  role: "agent"
  response: AgentResponse
}

interface ErrorMessage {
  role: "error"
}

type Message = UserMessage | AgentMessage | ErrorMessage

// ── Mock agent ─────────────────────────────────────────────────────────────────

const MOCK_RESPONSES: AgentResponse[] = [
  {
    answer:
      "Chips missed forecast by 5.4% ($8.2K below target) and Dairy fell short by 6.2% ($6.5K below). Both categories saw wholesale cost increases that weren't offset by price adjustments.",
    trace: [
      { tool: "query_forecast_table", args: { filters: { period: "last_60d" } } },
      { tool: "compute_delta", args: { group_by: "category", metric: "revenue" } },
    ],
    iterations: 2,
  },
  {
    answer:
      "Top performers last month were Oreo Double Stuf ($156.2K, 38.4% margin) and Gatorade Thirst Quencher ($118.5K, 44.7% margin). Both exceeded forecast and drove the strongest margin-per-unit numbers in their categories.",
    trace: [
      { tool: "query_product_table", args: { period: "last_30d", order_by: "revenue", limit: 5 } },
      { tool: "enrich_with_margin", args: { join: "cost_table" } },
    ],
    iterations: 2,
  },
  {
    answer:
      "Beverages revenue jumped 18% during the promo week vs the prior week, driven largely by Gatorade. Units sold increased 2.3× but margin per unit compressed from $1.51 to $1.12 due to the promotional discount depth.",
    trace: [
      { tool: "query_promo_calendar", args: { category: "Beverages" } },
      { tool: "compare_weeks", args: { metric: ["revenue", "units_sold", "margin_per_unit"] } },
      { tool: "attribute_to_sku", args: { top_n: 3 } },
    ],
    iterations: 3,
  },
]

async function mockFetch(prompt: string): Promise<AgentResponse> {
  await new Promise((r) => setTimeout(r, 1400))
  const idx = Math.floor(Math.random() * MOCK_RESPONSES.length)
  return MOCK_RESPONSES[idx]
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "Which category missed forecast?",
  "Top performers last month",
  "How did beverages do during the promo week?",
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-slate animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function ReasoningExpander({ trace }: { trace: ToolCall[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-slate hover:text-midnight transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "Hide reasoning" : "Show reasoning"}
        <span className="ml-1 text-slate/60">({trace.length} steps)</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1 rounded-lg bg-muted/60 px-3 py-2">
          {trace.map((t, i) => {
            const argsStr = Object.entries(t.args)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(", ")
            return (
              <p key={i} className="font-mono text-[11px] text-slate leading-relaxed">
                <span className="text-indigo">{t.tool}</span>({argsStr})
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AgentCard({ response }: { response: AgentResponse }) {
  return (
    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-4 py-3 shadow-sm border border-border/50">
      <p className="text-sm text-midnight leading-relaxed">{response.answer}</p>
      <ReasoningExpander trace={response.trace} />
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo px-4 py-2.5">
        <p className="text-sm text-white leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

// ── Main widget ────────────────────────────────────────────────────────────────

export function AskTheData() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text }])
    setLoading(true)

    try {
      const response = await mockFetch(text)
      setMessages((prev) => [...prev, { role: "agent", response }])
    } catch {
      setMessages((prev) => [...prev, { role: "error" }])
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask the Data"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: "#22D3A5" }}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>

      {/* Side panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-[400px] flex-col gap-0 rounded-l-2xl p-0 shadow-2xl sm:max-w-[400px]"
        >
          {/* Header */}
          <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "#22D3A5" }}>
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <SheetTitle className="text-base font-semibold text-midnight">Ask the Data</SheetTitle>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-slate hover:bg-muted hover:text-midnight transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 px-5 py-4">
            {isEmpty && (
              <div className="mb-4 rounded-xl bg-muted/40 px-4 py-3">
                <p className="text-xs text-slate leading-relaxed">
                  Ask anything about your Walmart supplier data — revenue, margin, forecast accuracy, regional trends, and more.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg, i) => {
                if (msg.role === "user") {
                  return <UserBubble key={i} text={msg.text} />
                }
                if (msg.role === "agent") {
                  return (
                    <div key={i}>
                      <AgentCard response={msg.response} />
                    </div>
                  )
                }
                // error
                return (
                  <Alert key={i} variant="destructive" className="rounded-xl border-rose/30 bg-rose/5">
                    <AlertDescription className="text-sm text-rose">
                      The agent is taking a breather. Try again in a moment.
                    </AlertDescription>
                  </Alert>
                )
              })}

              {loading && (
                <div>
                  <TypingIndicator />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Starter prompts — only show when empty */}
          {isEmpty && (
            <div className="flex flex-wrap gap-2 px-5 pb-3">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-midnight hover:border-teal hover:text-teal transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-teal transition-colors">
              <input
                className="flex-1 bg-transparent text-sm text-midnight placeholder:text-slate outline-none"
                placeholder="Ask a question about your data..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input) }}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                aria-label="Send"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: "#22D3A5" }}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
