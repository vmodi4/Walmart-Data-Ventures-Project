import { KPICards } from "@/components/kpi-cards"
import { RevenueMarginChart, type RevenueDataPoint } from "@/components/revenue-margin-chart"
import { CategoryDonutChart, type CategoryDataPoint } from "@/components/category-donut-chart"
import { RegionBarChart, type RegionDataPoint } from "@/components/region-bar-chart"
import { MarginPerUnitChart, type MarginProductDataPoint } from "@/components/margin-per-unit-chart"
import { QuadrantScatterChart, type QuadrantProductDataPoint } from "@/components/quadrant-scatter-chart"
import { ForecastActualChart, type ForecastDataPoint } from "@/components/forecast-actual-chart"
import { ChannelMixRadarChart, type ChannelMixData } from "@/components/channel-mix-radar-chart"
import { TopProductsTable, type TopProductRow } from "@/components/top-products-table"
import { AskTheData } from "@/components/ask-the-data"
import { AgentChat } from "@/components/agent-chat"
import { DashboardToolbar } from "@/components/dashboard-toolbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { api } from "@/lib/api"

export const revalidate = 3600

export default async function Home() {
  const [
    kpi,
    revenueVsCost,
    categoryBreakdown,
    regions,
    productMargins,
    productScatter,
    forecast,
    categoryMix,
    topProducts,
  ] = await Promise.all([
    api.kpi(),
    api.revenueVsCost(),
    api.categoryBreakdown(),
    api.salesByDimension(undefined, "region"),
    api.productMargins(undefined, 8),
    api.productScatter(),
    api.forecastVsActual(undefined, "category"),
    api.categoryMix(),
    api.topProducts({ start: "2026-03-21", end: "2026-04-20" }, 10, true),
  ])

  const chartData: RevenueDataPoint[] = revenueVsCost.map((r) => ({
    bucket: r.bucket,
    revenue: r.revenue,
    wholesale_cost: r.wholesale_cost,
    gross_margin: r.gross_margin,
    gross_margin_pct: r.gross_margin_pct,
  }))

  const categoryData: CategoryDataPoint[] = categoryBreakdown.map((r) => ({
    category: r.category,
    revenue: r.revenue,
    margin_pct: r.margin_pct,
    units_sold: r.units_sold,
  }))

  const regionData: RegionDataPoint[] = regions.map((r) => ({
    region: r.region ?? "",
    revenue: r.revenue,
    units_sold: r.units_sold,
    orders: r.orders,
  }))

  const marginProductData: MarginProductDataPoint[] = productMargins.map((r) => ({
    product_name: r.product_name,
    category: r.category,
    margin_per_unit: r.margin_per_unit,
    units_sold: r.units_sold,
  }))

  const quadrantData: QuadrantProductDataPoint[] = productScatter.map((r) => ({
    product_name: r.product_name,
    category: r.category,
    margin_per_unit: r.margin_per_unit,
    units_sold: r.units_sold,
    revenue: r.revenue,
  }))

  const forecastData: ForecastDataPoint[] = forecast.map((r) => ({
    category: r.category ?? "",
    forecasted_revenue: r.forecasted_revenue,
    actual_revenue: r.actual_revenue,
    revenue_delta_pct: r.revenue_delta_pct ?? 0,
  }))

  const channelMixData: ChannelMixData = {
    pos: categoryMix.pos ?? [],
    ecommerce: categoryMix.ecommerce ?? [],
  }

  const topProductsData: TopProductRow[] = topProducts.map((r) => ({
    product_name: r.product_name,
    category: r.category,
    revenue: r.revenue,
    units_sold: r.units_sold,
    growth_pct: r.growth_pct ?? 0,
  }))

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-muted py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center px-8">
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-midnight">Walmart Supplier Dashboard</h1>
          <div className="flex flex-1 justify-end">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <DashboardToolbar />
      <div className="mx-auto max-w-7xl p-8">
        <KPICards data={kpi} />
        <div className="mt-8">
          <RevenueMarginChart data={chartData} />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <CategoryDonutChart data={categoryData} />
          <RegionBarChart data={regionData} />
        </div>
        <div className="mt-8">
          <MarginPerUnitChart data={marginProductData} />
        </div>
        <div className="mt-8">
          <QuadrantScatterChart data={quadrantData} />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 items-stretch">
          <ForecastActualChart data={forecastData} />
          <ChannelMixRadarChart data={channelMixData} />
        </div>
        <div className="mt-8">
          <TopProductsTable data={topProductsData} />
        </div>
        <div className="mt-8">
          <AgentChat />
        </div>
      </div>
      <AskTheData />
    </main>
  )
}
