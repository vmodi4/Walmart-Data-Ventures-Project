"""FastAPI layer exposing the analytical tools as REST endpoints.

Each endpoint is a thin wrapper around a function in tools.py — the same
functions the Gemini agent uses. One source of truth, two consumers:

  * Dashboard (V0 / Next.js) hits these endpoints for chart data.
  * Agent calls the underlying Python functions directly via tool-calling.

OpenAPI / Swagger docs are auto-generated at /docs — that's the handoff
document for the designer.

Run locally:
    uvicorn api:app --reload --port 8000

Then open http://localhost:8000/docs in a browser.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import agent
import tools


class AgentQuestion(BaseModel):
    question: str

app = FastAPI(
    title="Walmart Data Ventures — Dashboard API",
    description=(
        "Sales analytics endpoints backing the V0 dashboard. All endpoints "
        "accept a date range (YYYY-MM-DD). Data is available for "
        "2026-02-20 through 2026-04-20."
    ),
    version="0.1.0",
)

# Dev-time CORS: any origin can hit the API. The V0 preview URLs are
# ephemeral (*.vercel.app / *.v0.dev), so pinning origins here would be
# friction during design iteration. Tighten for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health + metadata
# ---------------------------------------------------------------------------


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe. Returns immediately without touching Supabase."""
    return {"status": "ok"}


@app.get("/describe", tags=["meta"])
def describe() -> dict[str, Any]:
    """Metadata about the dataset: time window, categories, stores, regions,
    and which metrics are / are not available. Useful for the dashboard to
    populate filter dropdowns dynamically."""
    return tools.describe_data()


# ---------------------------------------------------------------------------
# Dashboard endpoints — one per chart / card
# ---------------------------------------------------------------------------


@app.get("/kpi", tags=["dashboard"])
def kpi(
    start: str = Query(..., description="ISO date YYYY-MM-DD", example="2026-02-20"),
    end: str = Query(..., description="ISO date YYYY-MM-DD", example="2026-04-20"),
) -> dict[str, Any]:
    """KPI card values: total_revenue, total_units_sold, average_order_value,
    ai_rescued_revenue, ai_rescued_revenue_pct."""
    return tools.get_kpi_summary(start, end)


@app.get("/sales-over-time", tags=["dashboard"])
def sales_over_time(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
    granularity: str = Query("week", pattern="^(day|week|month)$",
                             description="Time bucket size"),
    dimension: str = Query("category",
                           pattern="^(category|region|channel|store_id)$",
                           description="Series grouping"),
) -> Any:
    """Time-series of revenue grouped by a dimension. Feeds area/line charts.

    Response: list of `{bucket, <dimension>, revenue}` rows sorted by bucket.
    """
    return tools.get_sales_over_time(start, end, granularity, dimension)


@app.get("/sales-by-dimension", tags=["dashboard"])
def sales_by_dimension(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
    dimension: str = Query("region",
                           pattern="^(region|channel|store_id|category)$"),
) -> Any:
    """Revenue, units, and order counts aggregated across one dimension.
    Feeds horizontal bar charts, regional breakdowns, channel splits."""
    return tools.get_sales_by_dimension(start, end, dimension)


@app.get("/top-products", tags=["dashboard"])
def top_products(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
    n: int = Query(10, ge=1, le=50, description="Number of products to return"),
    category: str | None = Query(None,
                                 pattern="^(Cookies|Chips|Beverages|Dairy)$",
                                 description="Optional category filter"),
    with_growth: bool = Query(False,
                              description="Include period-over-period growth"),
) -> Any:
    """Top N products by revenue, optionally filtered to a category. Set
    `with_growth=true` to include a `growth_pct` column comparing against
    the prior equal-length period."""
    return tools.get_top_products(start, end, n=n, category=category,
                                   with_growth=with_growth)


@app.get("/forecast-vs-actual", tags=["dashboard"])
def forecast_vs_actual(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
    dimension: str = Query("category",
                           pattern="^(category|store_id|product_id|region|overall)$"),
) -> Any:
    """Forecasted vs actual revenue and units for a date range, grouped by
    a dimension. Each row includes `revenue_delta_pct`.

    Use `dimension=overall` for a single total comparison."""
    return tools.get_forecast_vs_actual(start, end, dimension)


@app.get("/product-pairs", tags=["dashboard"])
def product_pairs(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
    top_n: int = Query(20, ge=1, le=100),
) -> Any:
    """Market basket analysis — top N product pairs by co-occurrence within
    orders. Only multi-item orders (ecommerce) contribute."""
    return tools.get_product_pairs(start, end, top_n=top_n)


@app.get("/category-mix", tags=["dashboard"])
def category_mix(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
) -> dict[str, Any]:
    """Revenue share across the 4 categories for each channel (POS vs
    ecommerce). Shape: `{channel: [{category, revenue, share_pct}, ...]}`.
    Feeds the Channel Mix radar chart."""
    return tools.get_category_mix_by_channel(start, end)


@app.get("/revenue-vs-cost", tags=["dashboard"])
def revenue_vs_cost(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
    granularity: str = Query("week", pattern="^(day|week|month)$"),
) -> Any:
    """Time-series with retail revenue, wholesale cost, gross margin, and
    margin pct per bucket. For the layered area chart that shows the
    margin gap visually."""
    return tools.get_revenue_vs_cost(start, end, granularity)


@app.get("/product-margins", tags=["dashboard"])
def product_margins(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
    n: int = Query(20, ge=1, le=50),
    category: str | None = Query(None,
                                 pattern="^(Cookies|Chips|Beverages|Dairy)$"),
) -> Any:
    """Per-product margin analysis: avg margin per unit + units + revenue,
    sorted descending by margin per unit. For the horizontal margin bar chart."""
    return tools.get_product_margins(start, end, n=n, category=category)


@app.get("/category-breakdown", tags=["dashboard"])
def category_breakdown(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
) -> Any:
    """Per-category aggregates for donut or treemap: revenue (area),
    margin_pct (color), units sold, product count."""
    return tools.get_category_breakdown(start, end)


@app.get("/daily-sales-velocity", tags=["dashboard"])
def daily_sales_velocity(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
) -> Any:
    """Per-day units and revenue across the window, with zero rows for empty
    days. For the GitHub-style calendar heatmap.

    Note: data window is ~60 days, so the heatmap renders as a 2-month strip,
    not a year grid."""
    return tools.get_daily_sales_velocity(start, end)


@app.get("/product-scatter", tags=["dashboard"])
def product_scatter(
    start: str = Query(..., example="2026-02-20"),
    end: str = Query(..., example="2026-04-20"),
) -> Any:
    """One row per product with units (x), margin_per_unit (y), revenue
    (bubble size), category (color). For the BCG-quadrant scatter."""
    return tools.get_product_scatter(start, end)


# ---------------------------------------------------------------------------
# Agent endpoint — natural-language Q&A over the same tools
# ---------------------------------------------------------------------------


@app.post("/agent", tags=["agent"])
def agent_query(body: AgentQuestion) -> dict[str, Any]:
    """Run a natural-language question through the Gemini agent. The agent
    can call any of the dashboard tools as it answers.

    Request body: `{"question": "Which category missed forecast most?"}`

    Response: `{"answer": "...", "trace": [...], "iterations": int}`. The
    `trace` is the ordered list of tool calls the agent made, useful for
    showing reasoning in the UI ("the agent looked up forecast vs actual,
    then drilled into Beverages...")."""
    return agent.ask_agent(body.question)
