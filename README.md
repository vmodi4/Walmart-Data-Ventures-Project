# Walmart Data Ventures — Data Cleaning Pipeline Prototype

A prototype that ingests raw POS (CSV) and ecommerce (nested JSON) sales data,
reconciles the two formats into a unified schema, applies deterministic
cleaning, uses Gemini to resolve ambiguous product identifiers that rule-based
matching cannot handle, and loads a clean analytical table into Supabase.

A dashboard and an AI agent will query the clean `transactions` table in later
phases. This prototype covers the pipeline only.

## Architecture

```
raw_pos.csv ─┐
             ├─► pipeline.py ─► [deterministic clean] ─► [AI product resolution] ─► [join refs] ─► transactions
raw_ecom.json ┘
```

Three layers in Supabase:

- **Raw staging** — `raw_pos_transactions`, `raw_ecommerce_orders` (data as it arrived)
- **Reference** — `suppliers`, `stores`, `products`, `forecasts` (seeded master data)
- **Clean analytical** — `transactions` (the unified, enriched output)

## Setup

1. **Create a Supabase project** and copy the project URL and an API key
   (service role key is easiest for development).
2. **Get a Gemini API key** at https://aistudio.google.com/app/apikey (Google AI Studio — free tier covers this prototype).
3. **Install dependencies:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Fill in SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY
   ```

## Run order

Run these once, in order:

1. **Create schema** — open the Supabase SQL editor and paste/run the full
   contents of `supabase_setup.sql`.
2. **Seed reference data:**
   ```bash
   python seed_reference_tables.py
   ```
   Populates suppliers (5), stores (4), products (20), forecasts (~800 rows).
3. **Generate raw data:**
   ```bash
   python generate_raw_data.py
   ```
   Writes `data/raw_pos.csv` (~1050 rows incl. duplicates) and
   `data/raw_ecommerce.json` (~300 orders).
4. **Run the pipeline:**
   ```bash
   python pipeline.py
   ```
   Loads raw data into staging, cleans, AI-resolves, and writes ~1600 rows to
   `transactions`. Ends with a summary block.

To reset and re-run, re-execute `supabase_setup.sql` (the `DROP TABLE IF
EXISTS ... CASCADE` at the top clears state), then steps 2–4 again.

## Dashboard API (for the V0 designer)

Once the pipeline has populated Supabase, serve the dashboard endpoints:

```bash
uvicorn api:app --reload --port 8000
```

Interactive API docs (Swagger): **http://localhost:8000/docs**

That's the handoff page — every endpoint is listed with its parameters and
you can try queries live. Responses are ready-to-plot JSON.

**Available endpoints** (all GET, all return JSON):

| Endpoint | Dashboard component |
|---|---|
| `/describe` | Populate filter dropdowns (categories, stores, regions) |
| `/kpi` | KPI cards (revenue, units, AOV, AI-rescued revenue) |
| `/sales-over-time` | Sales Over Time area chart |
| `/sales-by-dimension` | Sales by Region bar chart (or channel / category / store) |
| `/top-products` | Top Products table (supports growth) |
| `/forecast-vs-actual` | Forecast vs Actual bar/line chart |
| `/product-pairs` | Product Relationships / market basket |
| `/category-mix` | Channel Mix radar chart |

**Data window:** all endpoints accept `start` and `end` query params as
ISO dates. Data is only available for **2026-02-20 through 2026-04-20**.

**Example requests:**
```bash
curl "http://localhost:8000/kpi?start=2026-02-20&end=2026-04-20"
curl "http://localhost:8000/sales-over-time?start=2026-02-20&end=2026-04-20&granularity=week&dimension=category"
curl "http://localhost:8000/top-products?start=2026-03-21&end=2026-04-20&n=10&with_growth=true"
```

CORS is wide open for development (`allow_origins=["*"]`) so the V0
preview URLs can call the API without extra setup. Tighten before prod.

## Demo queries (the PM-facing moment)

**Before** — abbreviated product names in raw staging, no product metadata:

```sql
SELECT transaction_id, upc_or_name, store_id, price_charged_cents
FROM raw_pos_transactions
WHERE upc_or_name !~ '^[0-9]+$'
ORDER BY transaction_id
LIMIT 20;
```

You will see rows like `GV WHL MLK 1GL`, `OREO CKE 14OZ`, `DORITOS NCHO 9Z` —
POS register abbreviations that would not join against the products table.

**After** — those same transactions, cleaned and enriched:

```sql
SELECT t.transaction_id, t.product_name, t.category, t.store_id, t.region,
       t.quantity, t.sale_price
FROM transactions t
JOIN raw_pos_transactions r USING (transaction_id)
WHERE r.upc_or_name !~ '^[0-9]+$'
ORDER BY t.transaction_id
LIMIT 20;
```

The abbreviations have been resolved to real products, joined to categories
and regions, and priced in dollars. That's the AI layer doing the last-mile
work that rule-based matching would have dropped.

**Forecast vs actual (sanity check for the dashboard phase):**

```sql
SELECT t.category, t.region,
       SUM(t.quantity)                  AS actual_units,
       SUM(t.quantity * t.sale_price)   AS actual_revenue
FROM transactions t
WHERE t.sale_date BETWEEN '2026-03-16' AND '2026-03-22'
GROUP BY t.category, t.region
ORDER BY actual_revenue DESC;
```

Compare against the same slice in `forecasts` to confirm the promo-week
beverage spike is visible.

## How this scales

What's here is intentionally lean so the code reads cleanly in a walkthrough.
The same structure extends in real production without rewrites:

- **Ingestion** — swap flat-file reads for a streaming source (Kafka, Kinesis,
  or Supabase realtime) and keep the staging tables as the landing zone.
- **Orchestration** — wrap each stage as an Airflow / Dagster task so
  retries, SLAs, and backfills are framework features, not custom code.
- **AI resolution** — batch unmatched identifiers into a single Gemini call
  (bigger prompt, one round trip), and persist the `{raw_string ->
  product_id}` map to a `product_alias` table so repeats skip the model
  entirely. Cache hit rate climbs to near 100% once the long tail is learned.
- **Catalog size** — for catalogs larger than a few hundred SKUs, embed
  products and run cosine similarity to pre-filter the candidate list before
  prompting, which keeps the prompt short and the answer precise.

## Layout

```
.
├── supabase_setup.sql          DDL for all 7 tables
├── seed_reference_tables.py    Suppliers, stores, products, forecasts
├── generate_raw_data.py        Writes data/raw_pos.csv + data/raw_ecommerce.json
├── pipeline.py                 7-stage cleaning pipeline
├── requirements.txt
├── .env.example
└── data/                       Generated raw files (gitignored)
```
