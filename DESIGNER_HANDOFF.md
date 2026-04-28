# Dashboard Handoff — V0 Build Guide

A self-contained brief for the designer building the Walmart Data Ventures
dashboard in V0. Skim section 1, do section 2 once, then work through the
component prompts in section 4.

---

## 1. The dashboard in one sentence

A sales analytics dashboard for a Walmart Data Ventures pitch — the data
covers two months of POS + ecommerce transactions across 4 stores, and the
charts are designed to make the data engineering pipeline (and especially
the AI product-resolution layer) visible to a PM audience.

The audience is **product managers, not analysts**. Visual clarity > metric
density. The "AI-rescued revenue" KPI is the prototype's unique pitch — it
should feel deliberate, not generic.

---

## 2. Quickstart

The technical owner runs the Python API locally:

```bash
cd backend
uvicorn api:app --reload --port 8000
```

Then **http://localhost:8000/docs** is your living reference. Every endpoint
is listed with parameters and a "Try it out" button — you can hit any of
them and see the actual response before writing anything.

Base URL during dev: `http://localhost:8000`. CORS is wide open so V0
preview URLs (any `*.v0.dev` / `*.vercel.app`) can call it directly.

---

## 3. How to use V0 for this project

V0 generates **real React + Next.js code** with shadcn/ui + Tailwind +
Recharts. The recommended workflow:

1. **One component at a time.** Don't try to build the whole dashboard in
   one prompt — quality drops sharply.
2. **Each prompt below already contains the response shape.** Paste the
   prompt verbatim into V0. It will generate the component using mock data
   that already matches the real API shape, so swapping mock → real later
   is a one-line edit.
3. **Iterate visually in the V0 chat.** "make this teal", "add a sparkline",
   "compress the padding". V0 is great at refinement.
4. **When happy, "Open in v0"** to spin up a Next.js project. The technical
   owner will then replace the mock data with `fetch()` calls to the API.

You do not need to write any fetch logic yourself. Stay in design.

---

## 4. Style guidance

- **Palette:** clean, modern, light theme. Subtle off-white background
  (#F8F9FB), white cards with soft shadows. **Accent color: teal #0EA5A5**
  for highlights, callouts, and the AI-rescued KPI. Use a darker navy
  (#0F172A) for primary text.
- **Category colors** (use consistently across charts):
  - Cookies → warm amber
  - Chips → orange-red
  - Beverages → teal/cyan
  - Dairy → soft blue
- **Density:** generous padding, large typography for KPI numbers, small
  but readable axis labels.
- **Charts:** Recharts (V0's default). Animations on initial load only,
  not on data updates.
- **Cards:** `shadcn/ui` Card with subtle borders, soft shadow, rounded-xl.

---

## 5. Component prompts

Suggested layout (top to bottom):

```
┌─────────────────────────────────────────────────────────┐
│  KPI Strip (4 cards)                                    │
├─────────────────────────────────────────────────────────┤
│  Revenue & Margin Over Time (full width hero)           │
├──────────────────────────────┬──────────────────────────┤
│  Category Breakdown (donut)  │  Sales by Region (bar)   │
├──────────────────────────────┼──────────────────────────┤
│  Margin per Product (bar)    │  Product Scatter (BCG)   │
├──────────────────────────────┼──────────────────────────┤
│  Forecast vs Actual (bar)    │  Channel Mix (radar)     │
├──────────────────────────────┼──────────────────────────┤
│  Top Products Table          │  Product Relationships   │
├─────────────────────────────────────────────────────────┤
│  Sales Velocity Heatmap (full width)                    │
└─────────────────────────────────────────────────────────┘

  + "Ask the Data" agent widget — floating chat button bottom-right,
    opens a panel/modal. Available from any page state.
```

### Component 1 — KPI Strip

**Endpoint:** `GET /kpi?start=2026-02-20&end=2026-04-20`

**Sample response:**
```json
{
  "total_revenue": 14178.33,
  "total_units_sold": 3502,
  "average_order_value": 10.95,
  "ai_rescued_revenue": 153.44,
  "ai_rescued_revenue_pct": 1.08
}
```

**V0 prompt:**
> Build a row of 4 KPI cards using shadcn/ui Card components. Component
> accepts a single prop `data` with this shape:
> `{ total_revenue: number, total_units_sold: number, average_order_value: number, ai_rescued_revenue: number, ai_rescued_revenue_pct: number }`.
>
> Cards in order: Total Revenue ($), Units Sold (number), Average Order
> Value ($), AI-Rescued Revenue ($ + percent). Each card has a label,
> the metric in large bold type, and a one-line subtitle.
>
> The AI-Rescued Revenue card should visually stand out — use a teal
> (#0EA5A5) accent border and a subtle gradient background. Add a small
> badge that says "AI" next to its label. The other three cards are
> neutral white with soft shadow. Use rounded-xl, generous padding.

---

### Component 2 — Revenue & Margin Over Time (hero chart)

**Endpoint:** `GET /revenue-vs-cost?start=2026-02-20&end=2026-04-20&granularity=week`

**Sample response (truncated):**
```json
[
  {"bucket": "2026-02-16", "revenue": 826.76, "wholesale_cost": 526.56, "gross_margin": 300.20, "gross_margin_pct": 36.3},
  {"bucket": "2026-02-23", "revenue": 1654.84, "wholesale_cost": 1049.68, "gross_margin": 605.16, "gross_margin_pct": 36.6},
  {"bucket": "2026-03-02", "revenue": 1828.29, "wholesale_cost": 1163.50, "gross_margin": 664.79, "gross_margin_pct": 36.4}
]
```

**V0 prompt:**
> Build a full-width hero area chart using Recharts. Component accepts an
> array of `{ bucket: string (ISO date), revenue: number, wholesale_cost: number, gross_margin: number, gross_margin_pct: number }`.
>
> Two stacked area series: wholesale_cost on the bottom (muted gray),
> gross_margin on top (teal #0EA5A5). The total height of the stack equals
> revenue, so the visible split makes the margin gap obvious at a glance.
>
> Add a header above the chart: "Revenue & Gross Margin" + subtitle
> "Wholesale cost is the floor — the teal layer above is your margin."
>
> X-axis: dates formatted as "Mar 2", "Mar 9", etc. Y-axis: dollars with
> $ prefix and k abbreviation ($1.5k). Tooltip on hover shows all four
> values with gross_margin_pct prominent.

---

### Component 3 — Category Breakdown (donut)

**Endpoint:** `GET /category-breakdown?start=2026-02-20&end=2026-04-20`

**Sample response:**
```json
[
  {"category": "Beverages", "revenue": 4482.76, "wholesale_cost": 2888.95, "units_sold": 882, "product_count": 5, "total_margin": 1593.81, "margin_pct": 35.6},
  {"category": "Chips", "revenue": 4118.50, "wholesale_cost": 2619.40, "units_sold": 872, "product_count": 5, "total_margin": 1499.10, "margin_pct": 36.4},
  {"category": "Cookies", "revenue": 3264.09, "wholesale_cost": 2066.44, "units_sold": 914, "product_count": 5, "total_margin": 1197.65, "margin_pct": 36.7},
  {"category": "Dairy", "revenue": 2312.98, "wholesale_cost": 1407.91, "units_sold": 834, "product_count": 5, "total_margin": 905.07, "margin_pct": 39.1}
]
```

**V0 prompt:**
> Build a donut chart using Recharts showing revenue share by category.
> Component accepts the array shape above.
>
> Slice size = revenue. Slice color from the category palette: Cookies
> warm amber, Chips orange-red, Beverages teal, Dairy soft blue.
>
> Center of the donut shows the total revenue across all categories.
>
> Below the donut, add a small legend table with: category name, revenue,
> margin %, units sold. Highlight the category with the highest margin %
> with a small "highest margin" badge.

---

### Component 4 — Sales by Region

**Endpoint:** `GET /sales-by-dimension?start=2026-02-20&end=2026-04-20&dimension=region`

**Sample response:**
```json
[
  {"region": "Northeast", "revenue": 4245.76, "units_sold": 1026, "orders": 206},
  {"region": "Midwest", "revenue": 3494.11, "units_sold": 843, "orders": 375},
  {"region": "South", "revenue": 3272.94, "units_sold": 834, "orders": 361},
  {"region": "West", "revenue": 3165.52, "units_sold": 799, "orders": 353}
]
```

**V0 prompt:**
> Build a horizontal bar chart with Recharts. Component accepts
> `Array<{ region: string, revenue: number, units_sold: number, orders: number }>`.
>
> Bars sorted by revenue descending. Each bar is teal (#0EA5A5) with a
> rounded right edge. Show revenue value at the end of each bar in $k
> format.
>
> Add a small caption note: "Northeast = ecommerce fulfillment center
> (FC-EAST in Bethlehem, PA)" — this explains why Northeast leads despite
> having no retail store.

---

### Component 5 — Margin per Product

**Endpoint:** `GET /product-margins?start=2026-02-20&end=2026-04-20&n=10`

**Sample response (truncated):**
```json
[
  {"product_id": "049000028928", "product_name": "Diet Coke 12pk", "category": "Beverages", "margin_per_unit": 2.47, "units_sold": 167, "revenue": 1142.84, "total_margin": 408.04, "margin_pct": 35.7},
  {"product_id": "049000028911", "product_name": "Coca-Cola 12pk", "category": "Beverages", "margin_per_unit": 2.42, "units_sold": 177, "revenue": 1206.24, "total_margin": 427.44, "margin_pct": 35.4}
]
```

**V0 prompt:**
> Build a horizontal bar chart with Recharts ranking products by margin
> per unit. Component accepts the array shape above.
>
> Each bar's color follows the category palette (Cookies amber, Chips
> orange-red, Beverages teal, Dairy soft blue). Bar length = margin_per_unit
> in dollars. To the right of each bar, show: product_name (truncated to
> 25 chars), then "$X.XX/unit", then a small gray "·  N units sold".
>
> Title: "Highest-Margin Products". Subtitle: "Margin per unit sold,
> last 60 days."

---

### Component 6 — Product Performance Scatter (BCG quadrant)

**Endpoint:** `GET /product-scatter?start=2026-02-20&end=2026-04-20`

**Sample response (truncated):**
```json
[
  {"product_id": "049000028911", "product_name": "Coca-Cola 12pk", "category": "Beverages", "units_sold": 177, "margin_per_unit": 2.42, "revenue": 1206.24},
  {"product_id": "049000028928", "product_name": "Diet Coke 12pk", "category": "Beverages", "units_sold": 167, "margin_per_unit": 2.47, "revenue": 1142.84}
]
```

**V0 prompt:**
> Build a scatter plot with Recharts. Component accepts the array shape
> above (one row per product).
>
> X-axis: units_sold. Y-axis: margin_per_unit ($). Bubble size scales
> with revenue. Bubble color from the category palette.
>
> Draw thin dashed lines at the median X and median Y to create 4
> quadrants. Label them subtly in the corners:
> - Top-right: "Stars" (high volume, high margin)
> - Bottom-right: "Workhorses" (high volume, thin margin)
> - Top-left: "Niche gems" (low volume, high margin)
> - Bottom-left: "Cut candidates"
>
> Hover tooltip shows: product_name, units_sold, margin_per_unit, revenue.
>
> Title: "Product Performance Quadrants".

---

### Component 7 — Forecast vs Actual

**Endpoint:** `GET /forecast-vs-actual?start=2026-02-20&end=2026-04-20&dimension=category`

**Sample response:**
```json
[
  {"category": "Beverages", "forecasted_revenue": 4942.17, "forecasted_units": 924, "actual_revenue": 4482.76, "actual_units": 882, "revenue_delta_pct": -9.3},
  {"category": "Chips", "forecasted_revenue": 3552.10, "forecasted_units": 740, "actual_revenue": 4118.50, "actual_units": 872, "revenue_delta_pct": 15.9},
  {"category": "Cookies", "forecasted_revenue": 2554.18, "forecasted_units": 701, "actual_revenue": 3264.09, "actual_units": 914, "revenue_delta_pct": 27.8},
  {"category": "Dairy", "forecasted_revenue": 1781.30, "forecasted_units": 625, "actual_revenue": 2312.98, "actual_units": 834, "revenue_delta_pct": 29.8}
]
```

**V0 prompt:**
> Build a grouped bar chart with Recharts. Component accepts the array
> shape above.
>
> Two bars per category: forecasted_revenue (muted gray) and
> actual_revenue (teal #0EA5A5 if positive delta, soft red if negative).
>
> To the right of each pair, show the revenue_delta_pct as a colored pill:
> green if positive, red if negative, with a +/− sign and percent.
>
> Title: "Forecast vs Actual — Revenue by Category".

---

### Component 8 — Channel Mix Radar

**Endpoint:** `GET /category-mix?start=2026-02-20&end=2026-04-20`

**Sample response:**
```json
{
  "ecommerce": [
    {"category": "Beverages", "revenue": 1995.27, "share_pct": 32.2},
    {"category": "Chips", "revenue": 1837.05, "share_pct": 29.7},
    {"category": "Cookies", "revenue": 1457.03, "share_pct": 23.5},
    {"category": "Dairy", "revenue": 905.91, "share_pct": 14.6}
  ],
  "pos": [
    {"category": "Beverages", "revenue": 2487.49, "share_pct": 31.2},
    {"category": "Chips", "revenue": 2281.45, "share_pct": 28.6},
    {"category": "Cookies", "revenue": 1807.06, "share_pct": 22.6},
    {"category": "Dairy", "revenue": 1407.07, "share_pct": 17.6}
  ]
}
```

**V0 prompt:**
> Build a radar (spider) chart with Recharts. Component accepts an object
> with two channel keys (`pos`, `ecommerce`) each mapping to an array of
> `{ category, revenue, share_pct }`.
>
> Four axes (one per category). Plot two overlaid polygons using share_pct
> as the radius: POS as a teal polygon (filled, 30% opacity) and ecommerce
> as navy outline (no fill). Legend at top.
>
> Title: "Category Mix by Channel".

---

### Component 9 — Top Products Table

**Endpoint:** `GET /top-products?start=2026-03-21&end=2026-04-20&n=10&with_growth=true`

**Sample response (truncated):**
```json
[
  {"product_id": "028400090711", "product_name": "Tostitos Scoops 10oz", "category": "Chips", "revenue": 615.22, "units_sold": 126, "prior_revenue": 337.42, "growth_pct": 82.3},
  {"product_id": "049000028928", "product_name": "Diet Coke 12pk", "category": "Beverages", "revenue": 613.88, "units_sold": 89, "prior_revenue": 528.96, "growth_pct": 16.1},
  {"product_id": "049000028911", "product_name": "Coca-Cola 12pk", "category": "Beverages", "revenue": 595.07, "units_sold": 86, "prior_revenue": 611.17, "growth_pct": -2.6}
]
```

**V0 prompt:**
> Build a clean shadcn/ui Table component. Component accepts the array
> shape above (top 10 products by revenue).
>
> Columns: Product (with a small category-colored dot before the name),
> Revenue ($), Units, Growth (vs prior period).
>
> The Growth column shows growth_pct as a colored pill: green up-arrow
> for positive, red down-arrow for negative. Sort by revenue descending.
>
> Title above the table: "Top Products — Last 30 Days".

---

### Component 10 — Product Relationships (basket affinity)

**Endpoint:** `GET /product-pairs?start=2026-02-20&end=2026-04-20&top_n=10`

**Sample response (truncated):**
```json
[
  {"product_a": "Cheetos Crunchy 8.5oz", "product_b": "Ruffles Original 8oz", "co_occurrences": 10},
  {"product_a": "Keebler Chips Deluxe 11.3oz", "product_b": "Oreo Original 14.3oz", "co_occurrences": 9},
  {"product_a": "Keebler Chips Deluxe 11.3oz", "product_b": "Sprite 2L", "co_occurrences": 9}
]
```

**V0 prompt:**
> Build a "frequently bought together" component showing product pairs.
> Component accepts the array shape above.
>
> Each row shows: product_a → product_b with a thin horizontal line
> between them, and the co_occurrences count as a small badge on the right
> ("× 10").
>
> The line thickness scales with co_occurrences (more co-occurrences =
> thicker line). Use teal for the lines.
>
> Title: "Frequently Bought Together". Subtitle: "Top product pairs
> appearing in the same order".

---

### Component 11 — Sales Velocity Heatmap

**Endpoint:** `GET /daily-sales-velocity?start=2026-02-20&end=2026-04-20`

**Sample response (truncated):**
```json
[
  {"sale_date": "2026-02-20", "units_sold": 28, "revenue": 110.42},
  {"sale_date": "2026-02-21", "units_sold": 41, "revenue": 168.91},
  {"sale_date": "2026-02-22", "units_sold": 35, "revenue": 142.18}
]
```

**Designer note:** the data window is only ~60 days, so this renders as a
two-month strip rather than a year-long contribution graph. Lay it out as
9 rows (weeks) × 7 columns (days), not a full year.

**V0 prompt:**
> Build a calendar heatmap component (GitHub contribution-graph style).
> Component accepts an array of
> `{ sale_date: string, units_sold: number, revenue: number }`.
>
> Layout: rows = weeks (Sunday to Saturday), columns = days. Each cell is
> a small rounded square colored by units_sold intensity (5 levels: pale
> teal → deep teal). Hover tooltip shows date, units_sold, revenue.
>
> The data covers about 9 weeks (Feb 20 – Apr 20, 2026), so the grid is
> roughly 9 rows × 7 columns. Add weekday labels on the left (S M T W T
> F S) and month dividers (Feb / Mar / Apr) along the top.
>
> Title: "Sales Velocity (Daily Units)".

---

### Component 12 — "Ask the Data" agent widget

**Endpoint:** `POST /agent` (note: this one is POST, not GET)

**Request body:**
```json
{ "question": "Which category missed forecast the most last month?" }
```

**Sample response:**
```json
{
  "answer": "Beverages missed its revenue forecast by 9.3%, coming in at $4,482.76 against a forecast of $4,942.17 from February 20 to April 20, 2026. Dairy beat its forecast the most at +29.8%.",
  "trace": [
    {
      "tool": "get_forecast_vs_actual",
      "args": {"start_date": "2026-02-20", "end_date": "2026-04-20", "dimension": "category"},
      "result_preview": "[{\"category\": \"Beverages\", \"forecasted_revenue\": 4942.17, \"actual_revenue\": 4482.76, \"revenue_delta_pct\": -9.3}, ...]"
    }
  ],
  "iterations": 2
}
```

**Behavior:** the agent calls one or more analytical tools behind the
scenes and synthesizes a natural-language answer. Each request takes
roughly **2-5 seconds** to return — bake this into the loading UX. The
`trace` array shows which tools were called and is the demo-magic moment
("watch it think") — surface it but don't let it dominate the answer.

**V0 prompt:**
> Build an "Ask the Data" chat widget using shadcn/ui. Component layout:
>
> 1. A floating circular button bottom-right of the page with a chat
>    icon (use lucide-react MessageCircle). Click opens a side panel
>    or modal.
> 2. Inside the panel: a header "Ask the Data", a chat-style message
>    list area, and a text input + Send button at the bottom.
> 3. Each user message renders as a right-aligned bubble. Each agent
>    response renders as a left-aligned card containing:
>    - The answer text (prominent, conversational, generous line height)
>    - A collapsible "Show reasoning" expander that lists each tool call
>      as a small monospace line: `tool_name(arg=value, ...)`
> 4. While waiting on a response, show a typing-indicator (3 animated
>    dots) in place of the answer card.
> 5. If the request errors (e.g. rate limited), show an Alert with a
>    friendly message: "The agent is taking a breather. Try again in a
>    moment." — don't expose raw 429s.
>
> The component manages its own message history state. For now, use this
> mock response shape (the technical owner will swap to real fetch later):
> `{ answer: string, trace: Array<{ tool: string, args: object }>, iterations: number }`.
>
> Style: teal (#0EA5A5) accent for the floating button and Send button.
> The reasoning expander text is small and muted gray. Round the panel
> generously (rounded-2xl) and add a subtle shadow.
>
> Suggested starter prompts to render as clickable chips above the
> input on first open: "Which category missed forecast?", "Top
> performers last month", "How did beverages do during the promo week?"

---

## 6. Final integration (technical owner)

Once the designer has the components looking right, the integration
becomes mechanical:

1. Each component currently takes mock data as a prop. Replace with a
   `useEffect` + `fetch()` against the matching endpoint.
2. Wrap the dashboard page in a date-range picker so all components
   share filters via context or a query param.
3. Add a small "Last updated" timestamp by hitting `/health` or
   reading inserted_at from `transactions`.

The whole dashboard then deploys to Vercel as a Next.js app pointing at
the FastAPI backend (host the API on Render / Fly.io / Railway for the
demo).

---

## 7. Reference

- API live at: `http://localhost:8000` (after `cd backend && uvicorn api:app --reload`)
- Interactive docs: `http://localhost:8000/docs`
- Data window: **2026-02-20 to 2026-04-20**. Endpoints accept any range
  inside this window via `start` and `end` ISO date params.
- Response shapes are stable — anything not in this doc, check `/docs`.
- Most endpoints are GET. **The agent endpoint is POST** with a JSON body
  `{ "question": "..." }` — see component 12.
