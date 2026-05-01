"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, Send, User, Bot } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"

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

// ── Mock insights ──────────────────────────────────────────────────────────────

const MOCK_INSIGHTS: Record<string, string> = {
  forecast:
    "Two categories missed forecast last period. Chips came in 5.4% below target ($142.8K vs $151K forecast), and Dairy fell 6.2% short ($98.5K vs $105K). The shortfall in both categories correlates with wholesale cost increases that weren't passed through to retail pricing. Cookies (+5.5%) and Beverages (+7.7%) both beat forecast and offset most of the shortfall at the portfolio level.",
  top:
    "Your top performers by revenue are Oreo Double Stuf 20oz ($156.2K, +12.5% growth), Lay's Classic Party Size ($142.8K, +8.2%), and Gatorade Thirst Quencher 32oz ($118.5K, +6.1%). Oreo also leads on margin per unit at $1.84, making it the clear flagship SKU. Worth noting: Tropicana OJ 52oz, while smaller in absolute revenue ($44.2K), posted the highest growth rate in the portfolio at +15.3%.",
  region:
    "The Northeast leads with $312.4K in revenue across 2,810 orders, followed by the Southeast at $278.6K. The West is your smallest region at $162.5K but has the highest revenue per order ($111.30 vs $104.40 in the Midwest). Expanding distribution in the West could yield outsized returns given the higher basket size.",
  margin:
    "Beverages has the strongest margin profile at 44.7%, driven by Gatorade ($1.51 margin per unit). Cookies follows at 38.4%. Dairy is your weak spot at 19.1% — Yoplait Original Strawberry contributes most of the volume but only $0.94 margin per unit. Consider repricing Dairy or shifting promotional spend toward higher-margin categories.",
  channel:
    "Your channel mix is heavily weighted to POS for Cookies (42% share) and Chips (37% share), while Beverages and Dairy are more balanced. E-commerce is underdeveloped for Cookies — only 17% share despite Cookies being your top revenue category. Investing in e-commerce visibility for Oreo and Chips Ahoy could unlock meaningful incremental volume.",
  default:
    "Looking at your dashboard, the headline numbers are strong: $1.25M total revenue, 15.8K units sold, and an AI-rescued revenue contribution of $187K (15% of total). The biggest opportunity is closing the forecast gap in Chips and Dairy, while doubling down on Cookies and Beverages where you're already exceeding plan. Northeast and Southeast continue to be your revenue engine, but the West offers the best per-order economics.",
}

function generateInsight(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes("forecast") || lower.includes("miss") || lower.includes("target")) {
    return MOCK_INSIGHTS.forecast
  }
  if (lower.includes("top") || lower.includes("best") || lower.includes("performer") || lower.includes("growth")) {
    return MOCK_INSIGHTS.top
  }
  if (lower.includes("region") || lower.includes("northeast") || lower.includes("west") || lower.includes("geo")) {
    return MOCK_INSIGHTS.region
  }
  if (lower.includes("margin") || lower.includes("profit")) {
    return MOCK_INSIGHTS.margin
  }
  if (lower.includes("channel") || lower.includes("ecommerce") || lower.includes("pos") || lower.includes("mix")) {
    return MOCK_INSIGHTS.channel
  }
  return MOCK_INSIGHTS.default
}

async function mockFetch(prompt: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1200))
  return generateInsight(prompt)
}

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
      const reply = await mockFetch(text)
      setMessages((prev) => [...prev, { role: "agent", text: reply }])
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
