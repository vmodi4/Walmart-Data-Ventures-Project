// Thin typed client for the FastAPI backend in /backend/api.py.
// Endpoints take an inclusive ISO date range; data window is 2026-02-20..2026-04-20.

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

export const DATA_WINDOW = {
  start: "2026-02-20",
  end: "2026-04-20",
} as const

export interface DateRange {
  start: string
  end: string
}

type QueryValue = string | number | boolean | undefined | null

async function getJSON<T>(
  path: string,
  params: Record<string, QueryValue> | object = {},
): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params as Record<string, QueryValue>)) {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  }
  const url = `${API_BASE_URL}${path}${qs.toString() ? `?${qs}` : ""}`
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

// ── Response shapes ────────────────────────────────────────────────────────────

export interface KpiSummary {
  total_revenue: number
  total_units_sold: number
  average_order_value: number
  ai_rescued_revenue: number
  ai_rescued_revenue_pct: number
}

export interface RevenueVsCostRow {
  bucket: string
  revenue: number
  wholesale_cost: number
  gross_margin: number
  gross_margin_pct: number
}

export interface CategoryBreakdownRow {
  category: "Cookies" | "Chips" | "Beverages" | "Dairy"
  revenue: number
  wholesale_cost: number
  units_sold: number
  product_count: number
  total_margin: number
  margin_pct: number
}

export interface SalesByDimensionRow {
  region?: string
  channel?: string
  store_id?: string
  category?: string
  revenue: number
  units_sold: number
  orders: number
}

export interface ProductMarginRow {
  product_id: string
  product_name: string
  category: "Cookies" | "Chips" | "Beverages" | "Dairy"
  margin_per_unit: number
  units_sold: number
  revenue: number
  total_margin: number
  margin_pct: number
}

export interface ProductScatterRow {
  product_id: string
  product_name: string
  category: "Cookies" | "Chips" | "Beverages" | "Dairy"
  margin_per_unit: number
  units_sold: number
  revenue: number
}

export interface ForecastVsActualRow {
  category?: string
  store_id?: string
  product_id?: string
  region?: string
  forecasted_revenue: number
  actual_revenue: number
  forecasted_units: number
  actual_units: number
  revenue_delta_pct: number | null
}

export interface ChannelMixRow {
  category: string
  revenue: number
  share_pct: number
}

export type CategoryMix = Record<string, ChannelMixRow[]>

export interface TopProductRow {
  product_id: string
  product_name: string
  category: "Cookies" | "Chips" | "Beverages" | "Dairy"
  revenue: number
  units_sold: number
  prior_revenue?: number
  growth_pct?: number | null
}

export interface AgentToolCall {
  tool: string
  args: Record<string, unknown>
  result_preview?: string
  error?: string
}

export interface AgentResponse {
  answer: string
  trace: AgentToolCall[]
  iterations: number
}

// ── Endpoints ──────────────────────────────────────────────────────────────────

export const api = {
  kpi: (range: DateRange = DATA_WINDOW) =>
    getJSON<KpiSummary>("/kpi", range),

  revenueVsCost: (range: DateRange = DATA_WINDOW, granularity: "day" | "week" | "month" = "week") =>
    getJSON<RevenueVsCostRow[]>("/revenue-vs-cost", { ...range, granularity }),

  categoryBreakdown: (range: DateRange = DATA_WINDOW) =>
    getJSON<CategoryBreakdownRow[]>("/category-breakdown", range),

  salesByDimension: (
    range: DateRange = DATA_WINDOW,
    dimension: "region" | "channel" | "store_id" | "category" = "region",
  ) => getJSON<SalesByDimensionRow[]>("/sales-by-dimension", { ...range, dimension }),

  productMargins: (range: DateRange = DATA_WINDOW, n = 20, category?: string) =>
    getJSON<ProductMarginRow[]>("/product-margins", { ...range, n, category }),

  productScatter: (range: DateRange = DATA_WINDOW) =>
    getJSON<ProductScatterRow[]>("/product-scatter", range),

  forecastVsActual: (
    range: DateRange = DATA_WINDOW,
    dimension: "category" | "store_id" | "product_id" | "region" | "overall" = "category",
  ) => getJSON<ForecastVsActualRow[]>("/forecast-vs-actual", { ...range, dimension }),

  categoryMix: (range: DateRange = DATA_WINDOW) =>
    getJSON<CategoryMix>("/category-mix", range),

  topProducts: (range: DateRange = DATA_WINDOW, n = 10, withGrowth = false, category?: string) =>
    getJSON<TopProductRow[]>("/top-products", {
      ...range,
      n,
      with_growth: withGrowth,
      category,
    }),

  askAgent: (question: string) =>
    postJSON<AgentResponse>("/agent", { question }),
}
