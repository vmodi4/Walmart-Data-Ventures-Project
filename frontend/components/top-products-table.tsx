"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react"

export type TopProductRow = {
  product_name: string
  category: "Cookies" | "Chips" | "Beverages" | "Dairy"
  revenue: number
  units_sold: number
  growth_pct: number
}

const CATEGORY_COLORS: Record<TopProductRow["category"], string> = {
  Cookies:   "#F59E0B",
  Chips:     "#F43F5E",
  Beverages: "#22D3A5",
  Dairy:     "#6366F1",
}

function formatRevenue(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n}`
}

interface TopProductsTableProps {
  data: TopProductRow[]
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  return (
    <div className="w-full rounded-xl bg-card px-6 py-5 shadow-sm">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-midnight">Top Products — Last 30 Days</h2>
        <p className="mt-0.5 text-sm text-slate">Ranked by revenue. Growth compared to prior 30-day period.</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-border/60">
            <TableHead className="w-8 text-xs font-medium uppercase tracking-wide text-slate">#</TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wide text-slate">Product</TableHead>
            <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-slate">Revenue</TableHead>
            <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-slate">Units</TableHead>
            <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-slate">Growth</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => {
            const color = CATEGORY_COLORS[row.category]
            const isPositive = row.growth_pct >= 0

            return (
              <TableRow key={row.product_name} className="border-border/40 hover:bg-muted/30">
                {/* Rank */}
                <TableCell className="text-sm text-slate">
                  {i + 1}
                </TableCell>

                {/* Product name + category dot */}
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div>
                      <p className="font-medium text-midnight">{row.product_name}</p>
                      <p className="text-xs text-slate">{row.category}</p>
                    </div>
                  </div>
                </TableCell>

                {/* Revenue */}
                <TableCell className="text-right font-semibold text-midnight">
                  {formatRevenue(row.revenue)}
                </TableCell>

                {/* Units */}
                <TableCell className="text-right text-slate">
                  {row.units_sold.toLocaleString()}
                </TableCell>

                {/* Growth pill */}
                <TableCell className="text-right">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      color: isPositive ? "#22D3A5" : "#F43F5E",
                      backgroundColor: isPositive ? "rgba(34,211,165,0.1)" : "rgba(244,63,94,0.1)",
                    }}
                  >
                    {isPositive
                      ? <ArrowUpIcon className="h-3 w-3" />
                      : <ArrowDownIcon className="h-3 w-3" />
                    }
                    {isPositive ? "+" : ""}{row.growth_pct.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
