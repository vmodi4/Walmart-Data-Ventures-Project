"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

export interface CategoryDataPoint {
  category: "Cookies" | "Chips" | "Beverages" | "Dairy"
  revenue: number
  margin_pct: number
  units_sold: number
}

const CATEGORY_COLORS: Record<CategoryDataPoint["category"], string> = {
  Cookies:   "#F59E0B", // warm amber
  Chips:     "#EF4444", // orange-red
  Beverages: "#22D3A5", // teal
  Dairy:     "#6366F1", // soft blue-indigo
}

function formatRevenue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(1)}k`
  return `$${value}`
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: CategoryDataPoint }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = CATEGORY_COLORS[d.category]
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="font-semibold text-midnight">{d.category}</span>
      </div>
      <div className="flex justify-between gap-8 text-slate">
        <span>Revenue</span>
        <span className="font-medium text-midnight">{formatRevenue(d.revenue)}</span>
      </div>
      <div className="flex justify-between gap-8 text-slate">
        <span>Margin</span>
        <span className="font-medium" style={{ color }}>{d.margin_pct.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between gap-8 text-slate">
        <span>Units sold</span>
        <span className="font-medium text-midnight">{d.units_sold.toLocaleString()}</span>
      </div>
    </div>
  )
}

interface CenterLabelProps {
  cx: number
  cy: number
  total: number
}

function CenterLabel({ cx, cy, total }: CenterLabelProps) {
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 12, fill: "var(--slate)" }}>
        Total revenue
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 20, fontWeight: 700, fill: "var(--midnight)" }}>
        {formatRevenue(total)}
      </text>
    </g>
  )
}

interface Props {
  data: CategoryDataPoint[]
}

export function CategoryDonutChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0)
  const highestMargin = data.reduce((best, d) => d.margin_pct > best.margin_pct ? d : best, data[0])

  return (
    <div className="w-full rounded-xl bg-card px-6 py-5 shadow-sm">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-midnight">Revenue by Category</h2>
        <p className="mt-0.5 text-sm text-slate">Slice size represents revenue share across product categories.</p>
      </div>

      {/* Stacked layout: donut on top, legend below */}
      <div className="flex flex-col items-center gap-4">

        {/* Donut chart — top, centered */}
        <div className="h-[260px] w-[260px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="revenue"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius="54%"
                outerRadius="80%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.category}
                    fill={CATEGORY_COLORS[entry.category]}
                    opacity={0.65}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {/* Ghost Pie for center label */}
              <Pie
                data={[{ value: 1 }]}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={0}
                label={({ cx, cy }: { cx: number; cy: number }) => (
                  <CenterLabel cx={cx} cy={cy} total={total} />
                )}
                labelLine={false}
                isAnimationActive={false}
              >
                <Cell fill="transparent" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend rows — below, full width */}
        <div className="w-full">
          {data.map((d) => {
            const isTop = d.category === highestMargin.category
            const color = CATEGORY_COLORS[d.category]
            return (
              <div
                key={d.category}
                className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0"
              >
                {/* Left: swatch + name + badge */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
                  <span className="font-medium text-midnight text-xs truncate">{d.category}</span>
                  {isTop && (
                    <span className="flex-shrink-0 rounded-full bg-teal/10 px-1.5 py-0.5 text-[9px] font-semibold text-teal leading-none">
                      top margin
                    </span>
                  )}
                </div>

                {/* Right: stats inline */}
                <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-midnight">{formatRevenue(d.revenue)}</span>
                  <span className="text-xs font-medium" style={{ color }}>{d.margin_pct.toFixed(1)}%</span>
                  <span className="text-xs text-slate">{d.units_sold.toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
