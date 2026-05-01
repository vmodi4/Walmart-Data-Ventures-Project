"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts"

export type ForecastDataPoint = {
  category: string
  forecasted_revenue: number
  actual_revenue: number
  revenue_delta_pct: number
}

function formatK(v: number) {
  return `$${(v / 1000).toFixed(0)}k`
}

function DeltaPill({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        background: positive ? "#DCFCE7" : "#FFE4E6",
        color: positive ? "#16A34A" : "#E11D48",
      }}
    >
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  )
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: ForecastDataPoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const positive = d.revenue_delta_pct >= 0
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-md">
      <p className="mb-2 text-sm font-semibold text-midnight">{label}</p>
      <div className="space-y-1 text-xs text-slate">
        <div className="flex justify-between gap-6">
          <span>Forecasted</span>
          <span className="font-medium text-midnight">{formatK(d.forecasted_revenue)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Actual</span>
          <span className="font-medium text-midnight">{formatK(d.actual_revenue)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-6 border-t border-border pt-2">
          <span>Delta</span>
          <span
            className="font-bold text-sm"
            style={{ color: positive ? "#16A34A" : "#E11D48" }}
          >
            {positive ? "+" : ""}{d.revenue_delta_pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

// Custom bar shape with rounded top corners
function RoundedBar(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props
  if (!height || height <= 0) return null
  const r = 3
  return (
    <path
      d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
      fill={fill}
    />
  )
}

// Renders the delta pill as an SVG foreignObject above each group
function DeltaLabel(props: {
  x?: number; y?: number; width?: number; value?: number; index?: number; data: ForecastDataPoint[]
}) {
  const { x = 0, y = 0, width = 0, index = 0, data } = props
  const d = data[index]
  if (!d) return null
  const positive = d.revenue_delta_pct >= 0
  const pct = `${positive ? "+" : ""}${d.revenue_delta_pct.toFixed(1)}%`
  const pillW = 52
  const pillH = 20
  const cx = x + width / 2

  return (
    <g>
      <rect
        x={cx - pillW / 2}
        y={y - pillH - 6}
        width={pillW}
        height={pillH}
        rx={10}
        fill={positive ? "#DCFCE7" : "#FFE4E6"}
      />
      <text
        x={cx}
        y={y - pillH / 2 - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight={600}
        fill={positive ? "#16A34A" : "#E11D48"}
      >
        {pct}
      </text>
    </g>
  )
}

export function ForecastActualChart({ data }: { data: ForecastDataPoint[] }) {
  return (
    <div className="w-full rounded-xl bg-card px-6 py-5 shadow-sm">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-midnight">Forecast vs Actual — Revenue by Category</h2>
        <p className="mt-0.5 text-sm text-slate">Grouped by category. Delta pill shows % over or under forecast.</p>
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-5 text-xs text-slate">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#CBD5E1]" />
          <span>Forecasted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#22D3A5]" />
          <span>Actual (positive delta)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#F43F5E]" />
          <span>Actual (negative delta)</span>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barCategoryGap="28%"
            barGap={4}
            margin={{ top: 36, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="2 4" stroke="#E2E8F0" strokeOpacity={0.7} vertical={false} />
            <XAxis
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--slate)", fontSize: 12 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--slate)", fontSize: 11 }}
              tickFormatter={formatK}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />

            {/* Forecasted bar — always muted slate */}
            <Bar dataKey="forecasted_revenue" name="Forecasted" shape={<RoundedBar />} maxBarSize={36}>
              {data.map((d) => (
                <Cell key={d.category} fill="#CBD5E1" fillOpacity={0.8} />
              ))}
            </Bar>

            {/* Actual bar — teal if positive delta, rose if negative */}
            <Bar dataKey="actual_revenue" name="Actual" shape={<RoundedBar />} maxBarSize={36}>
              {data.map((d) => (
                <Cell
                  key={d.category}
                  fill={d.revenue_delta_pct >= 0 ? "#22D3A5" : "#F43F5E"}
                  fillOpacity={0.85}
                />
              ))}
              <LabelList
                content={(props) => (
                  <DeltaLabel {...(props as Parameters<typeof DeltaLabel>[0])} data={data} />
                )}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
