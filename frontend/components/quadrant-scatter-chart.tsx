"use client"

import { useMemo } from "react"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts"

export type QuadrantProductDataPoint = {
  product_name: string
  category: "Cookies" | "Chips" | "Beverages" | "Dairy"
  margin_per_unit: number
  units_sold: number
  revenue: number
}

const CATEGORY_COLORS: Record<string, string> = {
  Cookies:   "#F59E0B",
  Chips:     "#F43F5E",
  Beverages: "#22D3A5",
  Dairy:     "#6366F1",
}

function formatRevenue(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v}`
}

function median(arr: number[]) {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

type TooltipPayload = { payload: QuadrantProductDataPoint }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = CATEGORY_COLORS[d.category]
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg text-sm min-w-[200px]">
      <p className="font-semibold text-midnight mb-2 leading-snug">{d.product_name}</p>
      <div className="flex justify-between gap-6 text-slate mb-0.5">
        <span>Category</span>
        <span className="font-medium" style={{ color }}>{d.category}</span>
      </div>
      <div className="flex justify-between gap-6 text-slate mb-0.5">
        <span>Units sold</span>
        <span className="font-medium text-midnight">{d.units_sold.toLocaleString()}</span>
      </div>
      <div className="flex justify-between gap-6 text-slate mb-0.5">
        <span>Margin / unit</span>
        <span className="font-semibold text-midnight">${d.margin_per_unit.toFixed(2)}</span>
      </div>
      <div className="flex justify-between gap-6 text-slate">
        <span>Revenue</span>
        <span className="font-medium text-midnight">{formatRevenue(d.revenue)}</span>
      </div>
    </div>
  )
}

// Custom dot that renders per-category color and scales with revenue
function CustomDot(props: {
  cx?: number
  cy?: number
  payload?: QuadrantProductDataPoint
  size?: number
}) {
  const { cx, cy, payload, size = 64 } = props
  if (cx === undefined || cy === undefined || !payload) return null
  const color = CATEGORY_COLORS[payload.category] ?? "#6366F1"
  const r = Math.sqrt(size) * 0.9
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      fillOpacity={0.35}
      stroke={color}
      strokeWidth={1.5}
      strokeOpacity={0.7}
    />
  )
}

// Quadrant label rendered as a Recharts customized label on ReferenceLine
function QuadrantLabel({
  viewBox,
  position,
  text,
}: {
  viewBox?: { x: number; y: number; width: number; height: number }
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left"
  text: string
}) {
  if (!viewBox) return null
  const { x, y, width, height } = viewBox
  const pad = 8

  let lx = x
  let ly = y
  let anchor: "start" | "end" = "start"

  if (position === "top-right") {
    lx = x + width - pad; ly = y + pad; anchor = "end"
  } else if (position === "top-left") {
    lx = x + pad; ly = y + pad; anchor = "start"
  } else if (position === "bottom-right") {
    lx = x + width - pad; ly = y + height - pad; anchor = "end"
  } else {
    lx = x + pad; ly = y + height - pad; anchor = "start"
  }

  return (
    <text
      x={lx}
      y={ly}
      textAnchor={anchor}
      dominantBaseline={position.startsWith("top") ? "hanging" : "auto"}
      fontSize={10}
      fontWeight={400}
      fill="var(--slate)"
      letterSpacing={0.3}
    >
      {text}
    </text>
  )
}

export function QuadrantScatterChart({ data }: { data: QuadrantProductDataPoint[] }) {
  const medX = useMemo(() => median(data.map((d) => d.units_sold)), [data])
  const medY = useMemo(() => median(data.map((d) => d.margin_per_unit)), [data])

  const minRev = Math.min(...data.map((d) => d.revenue))
  const maxRev = Math.max(...data.map((d) => d.revenue))

  return (
    <div className="w-full rounded-xl bg-card px-6 py-5 shadow-sm">
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-lg font-semibold text-midnight">Product Performance Quadrants</h2>
        <p className="mt-0.5 text-sm text-slate">
          Bubble size = revenue. Dashed lines mark median units sold &amp; margin per unit.
        </p>
      </div>

      {/* Category legend */}
      <div className="mb-4 flex flex-wrap gap-4 mt-3">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs text-slate">{cat}</span>
          </div>
        ))}
      </div>

      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 24, right: 32, left: 16, bottom: 32 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#E2E8F0" strokeOpacity={0.7} />
            <XAxis
              type="number"
              dataKey="units_sold"
              name="Units Sold"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--slate)", fontSize: 11 }}
              tickFormatter={(v: number) => v.toLocaleString()}
              label={{ value: "Units sold", position: "insideBottom", offset: -18, fill: "var(--slate)", fontSize: 11, fontWeight: 400 }}
            />
            <YAxis
              type="number"
              dataKey="margin_per_unit"
              name="Margin / Unit"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--slate)", fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              width={52}
              label={{ value: "Margin / unit", angle: -90, position: "insideLeft", offset: -2, fill: "var(--slate)", fontSize: 11, fontWeight: 400 }}
            />
            {/* ZAxis drives bubble size from revenue */}
            <ZAxis
              type="number"
              dataKey="revenue"
              range={[
                Math.max(200, (minRev / maxRev) * 1800),
                1800,
              ]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#E2E8F0" }} />

            {/* Median reference lines */}
            <ReferenceLine
              x={medX}
              stroke="#CBD5E1"
              strokeDasharray="5 4"
              strokeWidth={1.5}
            />
            <ReferenceLine
              y={medY}
              stroke="#CBD5E1"
              strokeDasharray="5 4"
              strokeWidth={1.5}
            />

            {/* Quadrant labels attached to the Y reference line's viewBox */}
            <ReferenceLine
              y={medY}
              stroke="transparent"
              label={(props: { viewBox?: { x: number; y: number; width: number; height: number } }) => (
                <>
                  <QuadrantLabel viewBox={props.viewBox} position="top-right" text="Stars" />
                  <QuadrantLabel viewBox={props.viewBox} position="top-left" text="Niche gems" />
                  <QuadrantLabel viewBox={props.viewBox} position="bottom-right" text="Workhorses" />
                  <QuadrantLabel viewBox={props.viewBox} position="bottom-left" text="Cut candidates" />
                </>
              )}
            />

            <Scatter
              data={data}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(props: any) => <CustomDot {...props} />}
              isAnimationActive
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
