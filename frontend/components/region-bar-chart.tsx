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

export type RegionDataPoint = {
  region: string
  revenue: number
  units_sold: number
  orders: number
}

function formatK(value: number): string {
  return `$${(value / 1000).toFixed(1)}k`
}

function formatFull(value: number): string {
  return `$${value.toLocaleString()}`
}

// Custom bar shape with rounded right corners only
function RoundedBar(props: any) {
  const { x, y, width, height, fill } = props
  if (!width || width <= 0) return null
  const r = Math.min(6, height / 2)
  return (
    <path
      d={`
        M${x},${y + r}
        Q${x},${y} ${x + r},${y}
        L${x + width - r},${y}
        Q${x + width},${y} ${x + width},${y + r}
        L${x + width},${y + height - r}
        Q${x + width},${y + height} ${x + width - r},${y + height}
        L${x + r},${y + height}
        Q${x},${y + height} ${x},${y + height - r}
        Z
      `}
      fill={fill}
    />
  )
}

// Custom tooltip
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as RegionDataPoint
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-midnight text-sm">{d.region}</p>
      <div className="flex justify-between gap-4">
        <span className="text-slate">Revenue</span>
        <span className="font-medium text-midnight">{formatFull(d.revenue)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-slate">Units Sold</span>
        <span className="font-medium text-midnight">{d.units_sold.toLocaleString()}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-slate">Orders</span>
        <span className="font-medium text-midnight">{d.orders.toLocaleString()}</span>
      </div>
    </div>
  )
}

export function RegionBarChart({ data }: { data: RegionDataPoint[] }) {
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="w-full rounded-xl bg-card px-4 py-4 shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-midnight">Revenue by Region</h2>
        <p className="mt-1 text-sm text-slate">Sorted by revenue, highest to lowest.</p>
      </div>

      {/* Chart */}
      <div style={{ height: sorted.length * 52 + 24 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 4, right: 72, left: 4, bottom: 4 }}
            barCategoryGap="30%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E2E8F0"
              strokeOpacity={0.6}
              horizontal={false}
            />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--slate)", fontSize: 11 }}
              tickFormatter={(v) => formatK(v)}
              domain={[0, "dataMax + 10000"]}
            />
            <YAxis
              type="category"
              dataKey="region"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--midnight)", fontSize: 13, fontWeight: 500 }}
              width={90}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
            <Bar
              dataKey="revenue"
              shape={<RoundedBar />}
              isAnimationActive={true}
            >
              {sorted.map((entry) => (
                <Cell key={entry.region} fill="#22D3A5" />
              ))}
              <LabelList
                dataKey="revenue"
                position="right"
                formatter={(v: number) => formatK(v)}
                style={{ fill: "var(--midnight)", fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Caption */}
      <p className="mt-3 text-xs text-slate border-t border-border pt-3 leading-relaxed">
        <span className="font-medium text-midnight">Note:</span>{" "}
        Northeast = ecommerce fulfillment center (FC-EAST in Bethlehem, PA) — this explains why
        Northeast leads despite having no retail store.
      </p>
    </div>
  )
}
