"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"

export interface RevenueDataPoint {
  bucket: string
  revenue: number
  wholesale_cost: number
  gross_margin: number
  gross_margin_pct: number
}

interface RevenueMarginChartProps {
  data: RevenueDataPoint[]
}

function formatDollar(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value}`
}

function formatDateLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d")
  } catch {
    return dateStr
  }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: RevenueDataPoint }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload

  return (
    <div className="min-w-[200px] rounded-xl border border-border/50 bg-background px-4 py-3 shadow-2xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate">
        {label ? formatDateLabel(label) : ""}
      </p>

      {/* Gross Margin % — prominent */}
      <div className="mb-3 flex items-baseline justify-between rounded-lg bg-indigo/5 px-3 py-2">
        <span className="text-sm font-semibold text-indigo">Gross Margin</span>
        <span className="text-2xl font-bold text-indigo">
          {d.gross_margin_pct.toFixed(1)}%
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#6366F1" }} />
            <span className="text-slate">Revenue</span>
          </div>
          <span className="font-semibold text-midnight">${d.revenue.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#F43F5E" }} />
            <span className="text-slate">Wholesale Cost</span>
          </div>
          <span className="font-semibold text-midnight">${d.wholesale_cost.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#6366F1" }} />
            <span className="text-slate">Gross Margin</span>
          </div>
          <span className="font-semibold text-midnight">${d.gross_margin.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

export function RevenueMarginChart({ data }: RevenueMarginChartProps) {
  return (
    <div className="w-full rounded-xl bg-card px-5 py-5 shadow-sm">
      {/* Header */}
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-midnight">Revenue &amp; Gross Margin</h2>
          <p className="mt-0.5 text-xs text-slate">
            Wholesale cost is the floor — the indigo layer above is your margin.
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#F43F5E" }} />
            Wholesale Cost
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#6366F1" }} />
            Gross Margin
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="wholesaleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#6366F1" stopOpacity={0.12} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#E2E8F0"
              strokeOpacity={0.8}
              vertical={false}
            />

            <XAxis
              dataKey="bucket"
              tickFormatter={formatDateLabel}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--slate)", fontSize: 11, fontFamily: "inherit" }}
              dy={8}
            />
            <YAxis
              tickFormatter={formatDollar}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--slate)", fontSize: 11, fontFamily: "inherit" }}
              dx={-4}
              width={52}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "#6366F1", strokeWidth: 1, strokeOpacity: 0.3, strokeDasharray: "4 2" }}
            />

            {/* Wholesale cost — bottom of stack, amber */}
            <Area
              type="monotone"
              dataKey="wholesale_cost"
              stackId="stack"
              stroke="#F43F5E"
              strokeWidth={1.5}
              strokeOpacity={0.7}
              fill="url(#wholesaleGrad)"
              isAnimationActive={true}
            />
            {/* Gross margin — top of stack, saturated */}
            <Area
              type="monotone"
              dataKey="gross_margin"
              stackId="stack"
              stroke="#6366F1"
              strokeWidth={2}
              strokeOpacity={1}
              fill="url(#marginGrad)"
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
