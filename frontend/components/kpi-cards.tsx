import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface KPIData {
  total_revenue: number
  total_units_sold: number
  average_order_value: number
  ai_rescued_revenue: number
  ai_rescued_revenue_pct: number
}

interface KPICardsProps {
  data: KPIData
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function KPICards({ data }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Revenue */}
      <Card className="rounded-xl border-0 bg-card p-6 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate">Total revenue</span>
            <Badge className="px-2 py-0.5 text-xs font-medium" style={{ color: "#6366F1", backgroundColor: "rgba(99,102,241,0.1)" }}>
              +8.5%
            </Badge>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-midnight">
            {formatCurrency(data.total_revenue)}
          </p>
          <div className="mt-3 h-1 w-12 rounded-full" style={{ backgroundColor: "#6366F1" }} />
        </CardContent>
      </Card>

      {/* Gross Margin */}
      <Card className="rounded-xl border-0 bg-card p-6 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate">Gross margin</span>
            <Badge className="px-2 py-0.5 text-xs font-medium" style={{ color: "#22D3A5", backgroundColor: "rgba(34,211,165,0.1)" }}>
              +2.1%
            </Badge>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-midnight">
            34.2%
          </p>
          <div className="mt-3 h-1 w-12 rounded-full" style={{ backgroundColor: "#22D3A5" }} />
        </CardContent>
      </Card>

      {/* Average Order Value */}
      <Card className="rounded-xl border-0 bg-card p-6 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate">Avg order value</span>
            <Badge className="px-2 py-0.5 text-xs font-medium" style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)" }}>
              +0.3%
            </Badge>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-midnight">
            {formatCurrency(data.average_order_value)}
          </p>
          <div className="mt-3 h-1 w-12 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
        </CardContent>
      </Card>

      {/* Margin Alerts */}
      <Card className="rounded-xl border-0 bg-card p-6 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate">Margin alerts</span>
            <Badge className="px-2 py-0.5 text-xs font-medium" style={{ color: "#F43F5E", backgroundColor: "rgba(244,63,94,0.1)" }}>
              3 items
            </Badge>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-midnight">
            -4.2%
          </p>
          <div className="mt-3 h-1 w-12 rounded-full" style={{ backgroundColor: "#F43F5E" }} />
        </CardContent>
      </Card>
    </div>
  )
}
