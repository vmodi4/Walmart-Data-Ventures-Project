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

const sampleData = {
  total_revenue: 1248750,
  total_units_sold: 15832,
  average_order_value: 78.9,
  ai_rescued_revenue: 187312,
  ai_rescued_revenue_pct: 15.0,
}

const chartData: RevenueDataPoint[] = [
  { bucket: "2024-03-02", revenue: 12500, wholesale_cost: 8750, gross_margin: 3750, gross_margin_pct: 30.0 },
  { bucket: "2024-03-09", revenue: 14200, wholesale_cost: 9940, gross_margin: 4260, gross_margin_pct: 30.0 },
  { bucket: "2024-03-16", revenue: 11800, wholesale_cost: 8260, gross_margin: 3540, gross_margin_pct: 30.0 },
  { bucket: "2024-03-23", revenue: 16500, wholesale_cost: 11220, gross_margin: 5280, gross_margin_pct: 32.0 },
  { bucket: "2024-03-30", revenue: 18200, wholesale_cost: 12376, gross_margin: 5824, gross_margin_pct: 32.0 },
  { bucket: "2024-04-06", revenue: 15800, wholesale_cost: 10744, gross_margin: 5056, gross_margin_pct: 32.0 },
  { bucket: "2024-04-13", revenue: 19500, wholesale_cost: 12675, gross_margin: 6825, gross_margin_pct: 35.0 },
  { bucket: "2024-04-20", revenue: 21200, wholesale_cost: 13780, gross_margin: 7420, gross_margin_pct: 35.0 },
]

const categoryData: CategoryDataPoint[] = [
  { category: "Cookies",   revenue: 156200, margin_pct: 38.4, units_sold: 4210 },
  { category: "Chips",     revenue: 142800, margin_pct: 31.2, units_sold: 3870 },
  { category: "Beverages", revenue: 118500, margin_pct: 44.7, units_sold: 5640 },
  { category: "Dairy",     revenue: 98500,  margin_pct: 19.1, units_sold: 2112 },
]

const regionData: RegionDataPoint[] = [
  { region: "Northeast",  revenue: 312400, units_sold: 8420, orders: 2810 },
  { region: "Southeast",  revenue: 278600, units_sold: 7130, orders: 2390 },
  { region: "Midwest",    revenue: 241800, units_sold: 6540, orders: 2180 },
  { region: "Southwest",  revenue: 198300, units_sold: 5360, orders: 1790 },
  { region: "West",       revenue: 162500, units_sold: 4390, orders: 1460 },
]

const marginProductData: MarginProductDataPoint[] = [
  { product_name: "Oreo Double Stuf 20oz",      category: "Cookies",   margin_per_unit: 1.84, units_sold: 4210 },
  { product_name: "Chips Ahoy! Chunky 13oz",    category: "Cookies",   margin_per_unit: 1.62, units_sold: 2980 },
  { product_name: "Gatorade Thirst Quencher 32oz", category: "Beverages", margin_per_unit: 1.51, units_sold: 5640 },
  { product_name: "Lay's Classic Party Size",   category: "Chips",     margin_per_unit: 1.38, units_sold: 3870 },
  { product_name: "Pepperidge Farm Milano",     category: "Cookies",   margin_per_unit: 1.27, units_sold: 1830 },
  { product_name: "Yoplait Original Strawberry",category: "Dairy",     margin_per_unit: 0.94, units_sold: 2112 },
  { product_name: "Fritos Corn Chips 9.25oz",   category: "Chips",     margin_per_unit: 0.88, units_sold: 1560 },
  { product_name: "Dasani Water 24pk",          category: "Beverages", margin_per_unit: 0.71, units_sold: 3290 },
]

const quadrantData: QuadrantProductDataPoint[] = [
  { product_name: "Oreo Double Stuf 20oz",        category: "Cookies",   margin_per_unit: 1.84, units_sold: 4210, revenue: 156200 },
  { product_name: "Chips Ahoy! Chunky 13oz",      category: "Cookies",   margin_per_unit: 1.62, units_sold: 2980, revenue: 98400  },
  { product_name: "Gatorade Thirst Quencher 32oz", category: "Beverages", margin_per_unit: 1.51, units_sold: 5640, revenue: 118500 },
  { product_name: "Lay's Classic Party Size",     category: "Chips",     margin_per_unit: 1.38, units_sold: 3870, revenue: 142800 },
  { product_name: "Pepperidge Farm Milano",       category: "Cookies",   margin_per_unit: 1.27, units_sold: 1830, revenue: 61200  },
  { product_name: "Yoplait Original Strawberry",  category: "Dairy",     margin_per_unit: 0.94, units_sold: 2112, revenue: 98500  },
  { product_name: "Fritos Corn Chips 9.25oz",     category: "Chips",     margin_per_unit: 0.88, units_sold: 1560, revenue: 47300  },
  { product_name: "Dasani Water 24pk",            category: "Beverages", margin_per_unit: 0.71, units_sold: 3290, revenue: 72100  },
]

const forecastData: ForecastDataPoint[] = [
  { category: "Cookies",   forecasted_revenue: 148000, actual_revenue: 156200, revenue_delta_pct:  5.5 },
  { category: "Chips",     forecasted_revenue: 151000, actual_revenue: 142800, revenue_delta_pct: -5.4 },
  { category: "Beverages", forecasted_revenue: 110000, actual_revenue: 118500, revenue_delta_pct:  7.7 },
  { category: "Dairy",     forecasted_revenue: 105000, actual_revenue:  98500, revenue_delta_pct: -6.2 },
]

const channelMixData: ChannelMixData = {
  pos: [
    { category: "Cookies",   revenue: 112000, share_pct: 42 },
    { category: "Chips",     revenue: 98000,  share_pct: 37 },
    { category: "Beverages", revenue: 61000,  share_pct: 23 },
    { category: "Dairy",     revenue: 71000,  share_pct: 27 },
  ],
  ecommerce: [
    { category: "Cookies",   revenue: 44200,  share_pct: 17 },
    { category: "Chips",     revenue: 44800,  share_pct: 17 },
    { category: "Beverages", revenue: 57500,  share_pct: 22 },
    { category: "Dairy",     revenue: 27500,  share_pct: 10 },
  ],
}

const topProductsData: TopProductRow[] = [
  { product_name: "Oreo Double Stuf 20oz",         category: "Cookies",   revenue: 156200, units_sold: 4210, growth_pct:  12.5 },
  { product_name: "Lay's Classic Party Size",      category: "Chips",     revenue: 142800, units_sold: 3870, growth_pct:   8.2 },
  { product_name: "Gatorade Thirst Quencher 32oz", category: "Beverages", revenue: 118500, units_sold: 5640, growth_pct:   6.1 },
  { product_name: "Chips Ahoy! Chunky 13oz",       category: "Cookies",   revenue: 98400,  units_sold: 2980, growth_pct:   4.7 },
  { product_name: "Yoplait Original Strawberry",   category: "Dairy",     revenue: 98500,  units_sold: 2112, growth_pct:  -2.1 },
  { product_name: "Pepperidge Farm Milano",        category: "Cookies",   revenue: 61200,  units_sold: 1830, growth_pct:   9.3 },
  { product_name: "Dasani Water 24pk",             category: "Beverages", revenue: 72100,  units_sold: 3290, growth_pct:  -4.8 },
  { product_name: "Fritos Corn Chips 9.25oz",      category: "Chips",     revenue: 47300,  units_sold: 1560, growth_pct:  -1.2 },
  { product_name: "Tropicana OJ 52oz",             category: "Beverages", revenue: 44200,  units_sold: 1420, growth_pct:  15.3 },
  { product_name: "Kraft Singles American",        category: "Dairy",     revenue: 38900,  units_sold: 1190, growth_pct:   3.6 },
]

export default function Home() {
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
        <KPICards data={sampleData} />
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
