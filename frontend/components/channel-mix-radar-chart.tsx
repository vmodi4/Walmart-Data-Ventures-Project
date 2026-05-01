"use client"

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

export type ChannelEntry = {
  category: string
  revenue: number
  share_pct: number
}

export type ChannelMixData = {
  pos: ChannelEntry[]
  ecommerce: ChannelEntry[]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { name: string; value: number; payload: { category: string } }[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const category = payload[0]?.payload?.category
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-md text-xs">
      <p className="font-semibold text-midnight mb-1.5">{category}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-slate">{p.name}</span>
          <span className="font-medium text-midnight">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export function ChannelMixRadarChart({ data }: { data: ChannelMixData }) {
  // Merge pos and ecommerce into per-category rows for RadarChart
  const categories = data.pos.map((d) => d.category)
  const merged = categories.map((cat) => {
    const posEntry = data.pos.find((d) => d.category === cat)
    const ecomEntry = data.ecommerce.find((d) => d.category === cat)
    return {
      category: cat,
      POS: posEntry?.share_pct ?? 0,
      Ecommerce: ecomEntry?.share_pct ?? 0,
    }
  })

  return (
    <div className="w-full rounded-xl bg-card px-6 py-5 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-lg font-semibold text-midnight">Category Mix by Channel</h2>
        <p className="mt-0.5 text-sm text-slate">Share of revenue per category, by sales channel.</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal" />
          <span className="text-xs text-slate font-medium">POS (In-store)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-indigo bg-transparent" />
          <span className="text-xs text-slate font-medium">Ecommerce</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={merged} margin={{ top: 16, right: 32, left: 32, bottom: 8 }}>
            <PolarGrid
              stroke="#E2E8F0"
              strokeOpacity={0.8}
            />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: "var(--slate)", fontSize: 11, fontWeight: 500 }}
              tickLine={false}
            />
            {/* POS — teal filled polygon */}
            <Radar
              name="POS (In-store)"
              dataKey="POS"
              stroke="#22D3A5"
              strokeWidth={1.5}
              fill="#22D3A5"
              fillOpacity={0.3}
              dot={false}
            />
            {/* Ecommerce — indigo outline only */}
            <Radar
              name="Ecommerce"
              dataKey="Ecommerce"
              stroke="#6366F1"
              strokeWidth={1.5}
              fill="#6366F1"
              fillOpacity={0}
              dot={false}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
