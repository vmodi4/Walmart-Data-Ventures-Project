"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts"

export type MarginProductDataPoint = {
  product_name: string
  category: "Cookies" | "Chips" | "Beverages" | "Dairy"
  margin_per_unit: number
  units_sold: number
}

const CATEGORY_COLORS: Record<string, string> = {
  Cookies:   "#F59E0B",
  Chips:     "#F43F5E",
  Beverages: "#22D3A5",
  Dairy:     "#6366F1",
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max).trimEnd() + "…" : str
}

type TooltipPayload = {
  payload: MarginProductDataPoint
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = CATEGORY_COLORS[d.category]
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg text-sm min-w-[180px]">
      <p className="font-semibold text-midnight mb-1">{d.product_name}</p>
      <div className="flex justify-between gap-6 text-slate">
        <span>Category</span>
        <span className="font-medium" style={{ color }}>{d.category}</span>
      </div>
      <div className="flex justify-between gap-6 text-slate">
        <span>Margin / unit</span>
        <span className="font-semibold text-midnight">${d.margin_per_unit.toFixed(2)}</span>
      </div>
      <div className="flex justify-between gap-6 text-slate">
        <span>Units sold</span>
        <span className="font-medium text-midnight">{d.units_sold.toLocaleString()}</span>
      </div>
    </div>
  )
}

// Custom bar label rendered to the right of each bar
function BarLabel({
  x, y, width, height, value, index, data,
}: {
  x?: number; y?: number; width?: number; height?: number
  value?: number; index?: number; data: MarginProductDataPoint[]
}) {
  if (x === undefined || y === undefined || width === undefined || height === undefined || index === undefined) return null
  const d = data[index]
  const labelX = x + width + 10
  const labelY = y + height / 2

  return (
    <g>
      <text x={labelX} y={labelY - 6} dominantBaseline="middle" fontSize={12} fontWeight={600} fill="var(--midnight)">
        {truncate(d.product_name, 25)}
      </text>
      <text x={labelX} y={labelY + 8} dominantBaseline="middle" fontSize={11} fill="var(--slate)">
        ${d.margin_per_unit.toFixed(2)}/unit
        <tspan fill="var(--slate)"> · {d.units_sold.toLocaleString()} units</tspan>
      </text>
    </g>
  )
}

// Rounded right-edge bar shape
function RoundedBar(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props
  if (width <= 0) return null
  const r = Math.min(4, height / 2)
  return (
    <path
      d={`M${x},${y} h${width - r} a${r},${r} 0 0 1 ${r},${r} v${height - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${width - r} Z`}
      fill={fill}
    />
  )
}

export function MarginPerUnitChart({ data }: { data: MarginProductDataPoint[] }) {
  const sorted = [...data].sort((a, b) => b.margin_per_unit - a.margin_per_unit)
  // Generous right margin so labels don't clip
  const rightMargin = 260

  return (
    <div className="w-full rounded-xl bg-card px-6 py-5 shadow-sm">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-midnight">Highest-Margin Products</h2>
        <p className="mt-0.5 text-sm text-slate">Margin per unit sold, last 60 days.</p>
      </div>

      <div style={{ height: sorted.length * 56 + 16 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={sorted}
            margin={{ top: 4, right: rightMargin, left: 0, bottom: 4 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.6} horizontal={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--slate)", fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
            <YAxis
              type="category"
              dataKey="product_name"
              hide
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
            <Bar
              dataKey="margin_per_unit"
              shape={(props: { x?: number; y?: number; width?: number; height?: number; fill?: string }) => <RoundedBar {...props} />}
              label={(props: { x?: number; y?: number; width?: number; height?: number; value?: number; index?: number }) => (
                <BarLabel {...props} data={sorted} />
              )}
              isAnimationActive
            >
              {sorted.map((entry) => (
                <Cell key={entry.product_name} fill={CATEGORY_COLORS[entry.category]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
