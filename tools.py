"""Agent + dashboard tool functions.

Each function answers one analytical question about the cleaned sales data.
The same functions serve two consumers:

  * The Gemini agent — each is exposed as a tool via GEMINI_TOOLS + DISPATCH.
  * The dashboard — a thin FastAPI layer (separate file) will wrap these
    functions as GET endpoints with identical shapes.

Data is loaded once from Supabase on first tool call and cached in memory.
The dataset is small (~1700 transactions, 800 forecasts, a few dozen
reference rows) so this is fine for a prototype — in production we'd query
on demand. Each tool call filters and aggregates in-process with zero
network round-trips after initial load.
"""

from __future__ import annotations

import logging
import os
from datetime import date, timedelta
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from google.genai import types as genai_types
from supabase import Client, create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
)
log = logging.getLogger("tools")


DATA_WINDOW_START = date(2026, 2, 20)
DATA_WINDOW_END = date(2026, 4, 20)


# ---------------------------------------------------------------------------
# Data loading (cached on first use)
# ---------------------------------------------------------------------------


_cache: dict[str, pd.DataFrame] = {}


def _supabase() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def _fetch_all(c: Client, table: str, page_size: int = 1000) -> list[dict]:
    """Paginate through a Supabase table.

    PostgREST caps each response at 1000 rows by default (no error, just
    silent truncation) — so a plain select returns only the first page on
    any table larger than that. This loops on .range() until a short page
    indicates we've hit the end.
    """
    rows: list[dict] = []
    start = 0
    while True:
        chunk = c.table(table).select("*").range(start, start + page_size - 1).execute().data
        rows.extend(chunk)
        if len(chunk) < page_size:
            return rows
        start += page_size


def _load_all() -> dict[str, pd.DataFrame]:
    """Pull all tables the tools need into DataFrames. Runs once per process."""
    if _cache:
        return _cache

    c = _supabase()

    tx = pd.DataFrame(_fetch_all(c, "transactions"))
    tx["sale_date"] = pd.to_datetime(tx["sale_date"]).dt.date
    tx["sale_timestamp"] = pd.to_datetime(tx["sale_timestamp"])
    tx["sale_price"] = tx["sale_price"].astype(float)
    tx["unit_price"] = tx["unit_price"].astype(float)
    tx["quantity"] = tx["quantity"].astype(int)
    tx["revenue"] = tx["sale_price"] * tx["quantity"]

    forecasts = pd.DataFrame(_fetch_all(c, "forecasts"))
    forecasts["week_start"] = pd.to_datetime(forecasts["week_start"]).dt.date
    forecasts["forecasted_revenue"] = forecasts["forecasted_revenue"].astype(float)
    forecasts["forecasted_units"] = forecasts["forecasted_units"].astype(int)

    products = pd.DataFrame(_fetch_all(c, "products"))
    stores = pd.DataFrame(_fetch_all(c, "stores"))
    raw_pos = pd.DataFrame(_fetch_all(c, "raw_pos_transactions"))

    _cache.update({
        "transactions": tx,
        "forecasts": forecasts,
        "products": products,
        "stores": stores,
        "raw_pos": raw_pos,
    })
    log.info("Loaded %d transactions, %d forecasts, %d products, %d stores",
             len(tx), len(forecasts), len(products), len(stores))
    return _cache


def _filter_by_date(df: pd.DataFrame, start_date: str, end_date: str,
                    col: str = "sale_date") -> pd.DataFrame:
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    mask = (df[col] >= start) & (df[col] <= end)
    return df[mask]


def _ai_rescued_transaction_ids(raw_pos: pd.DataFrame) -> set[str]:
    """POS rows whose raw upc_or_name was not a pure-digit UPC — i.e. the AI
    resolution stage saved them from being dropped."""
    mask = ~raw_pos["upc_or_name"].str.fullmatch(r"\d+", na=False)
    return set(raw_pos[mask]["transaction_id"])


# ---------------------------------------------------------------------------
# Tool 1 — describe_data (meta)
# ---------------------------------------------------------------------------


def describe_data() -> dict[str, Any]:
    """Return a summary of the available data: time window, dimensions,
    metrics available, and metrics NOT available.

    The agent should call this first when unsure whether a question can be
    answered, or to orient itself before other tool calls.
    """
    data = _load_all()
    tx = data["transactions"]
    stores = data["stores"]
    return {
        "time_window": {
            "start": DATA_WINDOW_START.isoformat(),
            "end": DATA_WINDOW_END.isoformat(),
            "description": "Approximately 2 months of simulated sales data.",
        },
        "channels": sorted(tx["channel"].unique().tolist()),
        "categories": sorted(tx["category"].unique().tolist()),
        "stores": stores[["store_id", "store_name", "city", "state",
                          "region", "store_type"]].to_dict(orient="records"),
        "regions": sorted(tx["region"].dropna().unique().tolist()),
        "total_transactions": int(len(tx)),
        "total_products": int(tx["product_id"].nunique()),
        "metrics_available": [
            "revenue (sale_price * quantity)",
            "units sold (quantity)",
            "average order value (revenue per unique order_id)",
            "forecasted vs actual units and revenue",
            "product co-occurrence within orders (market basket)",
            "AI-rescued revenue (POS rows saved by AI product matching)",
            "channel mix (POS vs ecommerce)",
        ],
        "metrics_unavailable": [
            "profit margin (retail and wholesale prices are stored, but net margin is not modeled)",
            "customer acquisition and signup counts",
            "fulfillment on-time rate (no SLA fields simulated)",
            "multi-year trends (window is only about 2 months)",
            "true seasonal patterns (window spans only Feb-Apr 2026)",
        ],
    }


# ---------------------------------------------------------------------------
# Tool 2 — get_kpi_summary
# ---------------------------------------------------------------------------


def get_kpi_summary(start_date: str, end_date: str) -> dict[str, Any]:
    """Top-line KPIs for a date range: total revenue, units, AOV, AI-rescued
    revenue. AI-rescued revenue = revenue from POS transactions whose raw
    identifier was an abbreviation (would have been dropped without the AI
    resolution stage)."""
    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date)

    revenue = float(tx["revenue"].sum())
    units = int(tx["quantity"].sum())
    # AOV = revenue per unique order (not per line item). Ecommerce orders
    # with multiple line items count once.
    aov = round(revenue / tx["order_id"].nunique(), 2) if len(tx) else 0.0

    rescued_tids = _ai_rescued_transaction_ids(data["raw_pos"])
    rescued = tx[tx["transaction_id"].isin(rescued_tids)]
    rescued_revenue = float(rescued["revenue"].sum())

    return {
        "total_revenue": round(revenue, 2),
        "total_units_sold": units,
        "average_order_value": aov,
        "ai_rescued_revenue": round(rescued_revenue, 2),
        "ai_rescued_revenue_pct": round(rescued_revenue / revenue * 100, 2)
                                   if revenue else 0.0,
    }


# ---------------------------------------------------------------------------
# Tool 3 — get_sales_over_time
# ---------------------------------------------------------------------------


def get_sales_over_time(start_date: str, end_date: str,
                        granularity: str = "week",
                        dimension: str = "category") -> Any:
    """Time-series of revenue grouped by a dimension.

    granularity: 'day', 'week', or 'month'.
    dimension:   'category', 'region', 'channel', or 'store_id'.
    """
    valid_grain = {"day", "week", "month"}
    valid_dim = {"category", "region", "channel", "store_id"}
    if granularity not in valid_grain:
        return {"error": f"granularity must be one of {sorted(valid_grain)}"}
    if dimension not in valid_dim:
        return {"error": f"dimension must be one of {sorted(valid_dim)}"}

    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date).copy()
    if tx.empty:
        return []

    sale_dt = pd.to_datetime(tx["sale_date"])
    if granularity == "day":
        tx["bucket"] = sale_dt.dt.date.astype(str)
    elif granularity == "week":
        tx["bucket"] = sale_dt.dt.to_period("W").dt.start_time.dt.date.astype(str)
    else:
        tx["bucket"] = sale_dt.dt.to_period("M").dt.start_time.dt.date.astype(str)

    grouped = tx.groupby(["bucket", dimension])["revenue"].sum().reset_index()
    grouped["revenue"] = grouped["revenue"].round(2)
    return grouped.sort_values(["bucket", dimension]).to_dict(orient="records")


# ---------------------------------------------------------------------------
# Tool 4 — get_sales_by_dimension
# ---------------------------------------------------------------------------


def get_sales_by_dimension(start_date: str, end_date: str,
                           dimension: str = "region") -> Any:
    """Revenue, units, and order counts aggregated across one dimension.

    dimension: 'region', 'channel', 'store_id', or 'category'.
    """
    valid_dim = {"region", "channel", "store_id", "category"}
    if dimension not in valid_dim:
        return {"error": f"dimension must be one of {sorted(valid_dim)}"}

    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date)
    if tx.empty:
        return []

    grouped = tx.groupby(dimension).agg(
        revenue=("revenue", "sum"),
        units_sold=("quantity", "sum"),
        orders=("order_id", "nunique"),
    ).reset_index()
    grouped["revenue"] = grouped["revenue"].round(2)
    return grouped.sort_values("revenue", ascending=False).to_dict(orient="records")


# ---------------------------------------------------------------------------
# Tool 5 — get_top_products
# ---------------------------------------------------------------------------


def get_top_products(start_date: str, end_date: str,
                     n: int = 10,
                     category: str | None = None,
                     with_growth: bool = False) -> Any:
    """Top N products by revenue for a date range.

    Optional category filter. If with_growth is True, includes
    period-over-period growth vs the prior equal-length period.
    """
    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date)
    if category:
        tx = tx[tx["category"] == category]
    if tx.empty:
        return []

    current = tx.groupby(["product_id", "product_name", "category"]).agg(
        revenue=("revenue", "sum"),
        units_sold=("quantity", "sum"),
    ).reset_index()
    current["revenue"] = current["revenue"].round(2)
    current = current.sort_values("revenue", ascending=False).head(n)

    if with_growth:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        length = (end - start).days
        prior_start = start - timedelta(days=length + 1)
        prior_end = start - timedelta(days=1)
        prior = _filter_by_date(data["transactions"],
                                prior_start.isoformat(),
                                prior_end.isoformat())
        if category:
            prior = prior[prior["category"] == category]
        prior_agg = prior.groupby("product_id").agg(
            prior_revenue=("revenue", "sum"),
        ).reset_index()
        current = current.merge(prior_agg, on="product_id", how="left")
        current["prior_revenue"] = current["prior_revenue"].fillna(0.0).round(2)
        current["growth_pct"] = current.apply(
            lambda r: round((r["revenue"] - r["prior_revenue"]) / r["prior_revenue"] * 100, 1)
                      if r["prior_revenue"] else None,
            axis=1,
        )

    return current.to_dict(orient="records")


# ---------------------------------------------------------------------------
# Tool 6 — get_forecast_vs_actual
# ---------------------------------------------------------------------------


def get_forecast_vs_actual(start_date: str, end_date: str,
                           dimension: str = "category") -> Any:
    """Forecast vs actual revenue and units for a date range, grouped by a
    dimension. Returns delta percentages.

    dimension: 'category', 'store_id', 'product_id', 'region', or 'overall'.
    """
    valid_dim = {"category", "store_id", "product_id", "region", "overall"}
    if dimension not in valid_dim:
        return {"error": f"dimension must be one of {sorted(valid_dim)}"}

    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date)
    fc = _filter_by_date(data["forecasts"], start_date, end_date, col="week_start")

    # Enrich forecasts with category and region for grouping
    fc = fc.merge(data["products"][["product_id", "category"]], on="product_id", how="left")
    fc = fc.merge(data["stores"][["store_id", "region"]], on="store_id", how="left")

    if fc.empty:
        return []

    if dimension == "overall":
        fc_rev = float(fc["forecasted_revenue"].sum())
        return [{
            "forecasted_revenue": round(fc_rev, 2),
            "actual_revenue": round(float(tx["revenue"].sum()), 2),
            "forecasted_units": int(fc["forecasted_units"].sum()),
            "actual_units": int(tx["quantity"].sum()),
            "revenue_delta_pct": round((tx["revenue"].sum() - fc_rev) / fc_rev * 100, 1)
                                  if fc_rev else None,
        }]

    tx_agg = tx.groupby(dimension).agg(
        actual_revenue=("revenue", "sum"),
        actual_units=("quantity", "sum"),
    ).reset_index()
    fc_agg = fc.groupby(dimension).agg(
        forecasted_revenue=("forecasted_revenue", "sum"),
        forecasted_units=("forecasted_units", "sum"),
    ).reset_index()

    merged = fc_agg.merge(tx_agg, on=dimension, how="outer").fillna(0)
    merged["actual_revenue"] = merged["actual_revenue"].astype(float).round(2)
    merged["forecasted_revenue"] = merged["forecasted_revenue"].astype(float).round(2)
    merged["actual_units"] = merged["actual_units"].astype(int)
    merged["forecasted_units"] = merged["forecasted_units"].astype(int)
    merged["revenue_delta_pct"] = merged.apply(
        lambda r: round((r["actual_revenue"] - r["forecasted_revenue"]) /
                         r["forecasted_revenue"] * 100, 1)
                   if r["forecasted_revenue"] else None,
        axis=1,
    )
    return merged.sort_values("forecasted_revenue", ascending=False).to_dict(orient="records")


# ---------------------------------------------------------------------------
# Tool 7 — get_product_pairs (market basket)
# ---------------------------------------------------------------------------


def get_product_pairs(start_date: str, end_date: str,
                      top_n: int = 20) -> Any:
    """Top N product pairs that most frequently appear in the same order.

    Only multi-item orders (effectively ecommerce) contribute. POS transactions
    are one line item per order by construction.
    """
    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date)
    multi = tx.groupby("order_id").filter(lambda g: len(g) > 1)
    if multi.empty:
        return []

    pairs: dict[tuple[str, str], int] = {}
    for _, group in multi.groupby("order_id"):
        products = sorted(group["product_id"].unique())
        for i in range(len(products)):
            for j in range(i + 1, len(products)):
                key = (products[i], products[j])
                pairs[key] = pairs.get(key, 0) + 1

    name_by_id = dict(zip(data["products"]["product_id"], data["products"]["product_name"]))
    ranked = sorted(pairs.items(), key=lambda x: -x[1])[:top_n]
    return [
        {
            "product_a": name_by_id.get(a, a),
            "product_b": name_by_id.get(b, b),
            "co_occurrences": count,
        }
        for (a, b), count in ranked
    ]


# ---------------------------------------------------------------------------
# Tool 8 — get_category_mix_by_channel (radar replacement)
# ---------------------------------------------------------------------------


def get_category_mix_by_channel(start_date: str, end_date: str) -> Any:
    """Revenue share across the 4 categories for each channel (POS vs
    ecommerce). Shape is suitable for a radar chart: category axes with one
    polygon per channel."""
    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date)
    if tx.empty:
        return {}

    grouped = tx.groupby(["channel", "category"])["revenue"].sum().reset_index()
    totals = grouped.groupby("channel")["revenue"].transform("sum")
    grouped["share_pct"] = (grouped["revenue"] / totals * 100).round(1)

    by_channel: dict[str, list[dict[str, Any]]] = {}
    for channel in sorted(grouped["channel"].unique()):
        rows = grouped[grouped["channel"] == channel].sort_values("category")
        by_channel[channel] = [
            {"category": r["category"],
             "revenue": round(float(r["revenue"]), 2),
             "share_pct": float(r["share_pct"])}
            for _, r in rows.iterrows()
        ]
    return by_channel


# ---------------------------------------------------------------------------
# Tool 9 — get_revenue_vs_cost (revenue + wholesale + gross margin over time)
# ---------------------------------------------------------------------------


def get_revenue_vs_cost(start_date: str, end_date: str,
                         granularity: str = "week") -> Any:
    """Time-series with retail revenue, wholesale cost, and gross margin per
    bucket. Used for the layered area chart that shows the margin gap.

    granularity: 'day', 'week', or 'month'.
    """
    valid_grain = {"day", "week", "month"}
    if granularity not in valid_grain:
        return {"error": f"granularity must be one of {sorted(valid_grain)}"}

    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date).copy()
    if tx.empty:
        return []

    tx["wholesale_cost"] = tx["unit_price"] * tx["quantity"]

    sale_dt = pd.to_datetime(tx["sale_date"])
    if granularity == "day":
        tx["bucket"] = sale_dt.dt.date.astype(str)
    elif granularity == "week":
        tx["bucket"] = sale_dt.dt.to_period("W").dt.start_time.dt.date.astype(str)
    else:
        tx["bucket"] = sale_dt.dt.to_period("M").dt.start_time.dt.date.astype(str)

    grouped = tx.groupby("bucket").agg(
        revenue=("revenue", "sum"),
        wholesale_cost=("wholesale_cost", "sum"),
    ).reset_index()
    grouped["gross_margin"] = (grouped["revenue"] - grouped["wholesale_cost"]).round(2)
    grouped["gross_margin_pct"] = ((grouped["gross_margin"] / grouped["revenue"]) * 100).round(1)
    grouped["revenue"] = grouped["revenue"].round(2)
    grouped["wholesale_cost"] = grouped["wholesale_cost"].round(2)
    return grouped.sort_values("bucket").to_dict(orient="records")


# ---------------------------------------------------------------------------
# Tool 10 — get_product_margins
# ---------------------------------------------------------------------------


def get_product_margins(start_date: str, end_date: str,
                         n: int = 20,
                         category: str | None = None) -> Any:
    """Per-product margin analysis: average sale_price - unit_price, plus
    total units sold and revenue. Sorted descending by margin per unit.

    Used for the horizontal bar chart that highlights highest-margin SKUs.
    """
    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date)
    if category:
        tx = tx[tx["category"] == category]
    if tx.empty:
        return []

    tx = tx.copy()
    tx["margin_per_unit"] = tx["sale_price"] - tx["unit_price"]
    tx["wholesale_cost"] = tx["unit_price"] * tx["quantity"]

    grouped = tx.groupby(["product_id", "product_name", "category"]).agg(
        margin_per_unit=("margin_per_unit", "mean"),
        units_sold=("quantity", "sum"),
        revenue=("revenue", "sum"),
        wholesale_cost=("wholesale_cost", "sum"),
    ).reset_index()
    grouped["margin_per_unit"] = grouped["margin_per_unit"].round(2)
    grouped["revenue"] = grouped["revenue"].round(2)
    grouped["total_margin"] = (grouped["revenue"] - grouped["wholesale_cost"]).round(2)
    grouped["margin_pct"] = ((grouped["total_margin"] / grouped["revenue"]) * 100).round(1)
    grouped = grouped.drop(columns=["wholesale_cost"])

    return grouped.sort_values("margin_per_unit", ascending=False).head(n).to_dict(orient="records")


# ---------------------------------------------------------------------------
# Tool 11 — get_category_breakdown (revenue + margin per category)
# ---------------------------------------------------------------------------


def get_category_breakdown(start_date: str, end_date: str) -> Any:
    """Per-category aggregates suitable for a donut or treemap: revenue (area),
    margin_pct (color), units sold. One row per category."""
    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date).copy()
    if tx.empty:
        return []

    tx["wholesale_cost"] = tx["unit_price"] * tx["quantity"]
    grouped = tx.groupby("category").agg(
        revenue=("revenue", "sum"),
        wholesale_cost=("wholesale_cost", "sum"),
        units_sold=("quantity", "sum"),
        product_count=("product_id", "nunique"),
    ).reset_index()
    grouped["total_margin"] = (grouped["revenue"] - grouped["wholesale_cost"]).round(2)
    grouped["margin_pct"] = ((grouped["total_margin"] / grouped["revenue"]) * 100).round(1)
    grouped["revenue"] = grouped["revenue"].round(2)
    grouped["wholesale_cost"] = grouped["wholesale_cost"].round(2)
    return grouped.sort_values("revenue", ascending=False).to_dict(orient="records")


# ---------------------------------------------------------------------------
# Tool 12 — get_daily_sales_velocity (calendar heatmap)
# ---------------------------------------------------------------------------


def get_daily_sales_velocity(start_date: str, end_date: str) -> Any:
    """Per-day units sold and revenue across the date range. Includes zero
    rows for days with no sales so the heatmap renders a continuous strip.
    """
    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date)
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    all_days = pd.DataFrame({"sale_date": pd.date_range(start, end, freq="D").date})

    if tx.empty:
        all_days["units_sold"] = 0
        all_days["revenue"] = 0.0
        all_days["sale_date"] = all_days["sale_date"].astype(str)
        return all_days.to_dict(orient="records")

    grouped = tx.groupby("sale_date").agg(
        units_sold=("quantity", "sum"),
        revenue=("revenue", "sum"),
    ).reset_index()
    merged = all_days.merge(grouped, on="sale_date", how="left").fillna(0)
    merged["units_sold"] = merged["units_sold"].astype(int)
    merged["revenue"] = merged["revenue"].astype(float).round(2)
    merged["sale_date"] = merged["sale_date"].astype(str)
    return merged.sort_values("sale_date").to_dict(orient="records")


# ---------------------------------------------------------------------------
# Tool 13 — get_product_scatter (BCG quadrants)
# ---------------------------------------------------------------------------


def get_product_scatter(start_date: str, end_date: str) -> Any:
    """One row per product with units sold (x), avg margin per unit (y),
    total revenue (bubble size), and category (color). Feeds the
    BCG-quadrant scatter plot."""
    data = _load_all()
    tx = _filter_by_date(data["transactions"], start_date, end_date).copy()
    if tx.empty:
        return []

    tx["margin_per_unit"] = tx["sale_price"] - tx["unit_price"]
    grouped = tx.groupby(["product_id", "product_name", "category"]).agg(
        units_sold=("quantity", "sum"),
        margin_per_unit=("margin_per_unit", "mean"),
        revenue=("revenue", "sum"),
    ).reset_index()
    grouped["margin_per_unit"] = grouped["margin_per_unit"].round(2)
    grouped["revenue"] = grouped["revenue"].round(2)
    return grouped.sort_values("revenue", ascending=False).to_dict(orient="records")


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------


DISPATCH = {
    "describe_data": describe_data,
    "get_kpi_summary": get_kpi_summary,
    "get_sales_over_time": get_sales_over_time,
    "get_sales_by_dimension": get_sales_by_dimension,
    "get_top_products": get_top_products,
    "get_forecast_vs_actual": get_forecast_vs_actual,
    "get_product_pairs": get_product_pairs,
    "get_category_mix_by_channel": get_category_mix_by_channel,
    "get_revenue_vs_cost": get_revenue_vs_cost,
    "get_product_margins": get_product_margins,
    "get_category_breakdown": get_category_breakdown,
    "get_daily_sales_velocity": get_daily_sales_velocity,
    "get_product_scatter": get_product_scatter,
}


# ---------------------------------------------------------------------------
# Gemini tool schema
# ---------------------------------------------------------------------------


def _date_range_params() -> dict[str, Any]:
    return {
        "start_date": {
            "type": "string",
            "description": ("Start of analysis window, ISO date (YYYY-MM-DD). "
                            "Data is only available between 2026-02-20 and 2026-04-20."),
        },
        "end_date": {
            "type": "string",
            "description": ("End of analysis window, ISO date (YYYY-MM-DD), inclusive. "
                            "Data is only available between 2026-02-20 and 2026-04-20."),
        },
    }


GEMINI_TOOLS = [
    genai_types.Tool(function_declarations=[
        genai_types.FunctionDeclaration(
            name="describe_data",
            description=("Summary of the available data: time window, dimensions, "
                         "metrics available, and metrics NOT available. Call this "
                         "FIRST when unsure whether a question can be answered."),
            parameters={"type": "object", "properties": {}},
        ),
        genai_types.FunctionDeclaration(
            name="get_kpi_summary",
            description=("Top-line KPIs for a date range: total revenue, units "
                         "sold, average order value, and AI-rescued revenue."),
            parameters={
                "type": "object",
                "properties": _date_range_params(),
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_sales_over_time",
            description=("Time-series of revenue grouped by a dimension. Use for "
                         "trend, line, or area-chart questions."),
            parameters={
                "type": "object",
                "properties": {
                    **_date_range_params(),
                    "granularity": {
                        "type": "string",
                        "enum": ["day", "week", "month"],
                        "description": "Time bucket size. Default 'week'.",
                    },
                    "dimension": {
                        "type": "string",
                        "enum": ["category", "region", "channel", "store_id"],
                        "description": "Dimension to group by. Default 'category'.",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_sales_by_dimension",
            description=("Revenue, units, and order counts aggregated across one "
                         "dimension. Use for bar charts and breakdowns."),
            parameters={
                "type": "object",
                "properties": {
                    **_date_range_params(),
                    "dimension": {
                        "type": "string",
                        "enum": ["region", "channel", "store_id", "category"],
                        "description": "Dimension to group by. Default 'region'.",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_top_products",
            description=("Top N products by revenue for a date range. Supports "
                         "category filtering and period-over-period growth."),
            parameters={
                "type": "object",
                "properties": {
                    **_date_range_params(),
                    "n": {
                        "type": "integer",
                        "description": "Number of products to return. Default 10.",
                    },
                    "category": {
                        "type": "string",
                        "enum": ["Cookies", "Chips", "Beverages", "Dairy"],
                        "description": "Optional category filter.",
                    },
                    "with_growth": {
                        "type": "boolean",
                        "description": ("Include period-over-period growth vs the "
                                        "prior equal-length period. Default false."),
                    },
                },
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_forecast_vs_actual",
            description=("Compare forecasted vs actual revenue and units for a "
                         "date range, grouped by a dimension. Returns delta percentages."),
            parameters={
                "type": "object",
                "properties": {
                    **_date_range_params(),
                    "dimension": {
                        "type": "string",
                        "enum": ["category", "store_id", "product_id", "region", "overall"],
                        "description": ("Dimension to group by. Use 'overall' for a "
                                        "single total. Default 'category'."),
                    },
                },
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_product_pairs",
            description=("Top N product pairs that most frequently appear in the "
                         "same order (market basket analysis)."),
            parameters={
                "type": "object",
                "properties": {
                    **_date_range_params(),
                    "top_n": {
                        "type": "integer",
                        "description": "Number of pairs to return. Default 20.",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_category_mix_by_channel",
            description=("Revenue share across the 4 categories for each channel "
                         "(POS vs ecommerce). Suitable for a radar chart."),
            parameters={
                "type": "object",
                "properties": _date_range_params(),
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_revenue_vs_cost",
            description=("Time-series with retail revenue, wholesale cost, and "
                         "gross margin per bucket. Use for layered area charts "
                         "showing the margin gap."),
            parameters={
                "type": "object",
                "properties": {
                    **_date_range_params(),
                    "granularity": {
                        "type": "string",
                        "enum": ["day", "week", "month"],
                        "description": "Time bucket size. Default 'week'.",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_product_margins",
            description=("Per-product margin: average sale_price minus unit_price, "
                         "with units sold and revenue context. Sorted descending "
                         "by margin per unit."),
            parameters={
                "type": "object",
                "properties": {
                    **_date_range_params(),
                    "n": {"type": "integer", "description": "Number of products. Default 20."},
                    "category": {
                        "type": "string",
                        "enum": ["Cookies", "Chips", "Beverages", "Dairy"],
                        "description": "Optional category filter.",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_category_breakdown",
            description=("Per-category aggregates for donut/treemap charts: "
                         "revenue (area), margin_pct (color), units sold."),
            parameters={
                "type": "object",
                "properties": _date_range_params(),
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_daily_sales_velocity",
            description=("Per-day units sold and revenue across the date range, "
                         "with zero rows for days that had no sales. Suitable "
                         "for a calendar heatmap."),
            parameters={
                "type": "object",
                "properties": _date_range_params(),
                "required": ["start_date", "end_date"],
            },
        ),
        genai_types.FunctionDeclaration(
            name="get_product_scatter",
            description=("One row per product with units sold (x), avg margin "
                         "per unit (y), revenue (bubble size), and category. "
                         "Feeds a BCG-quadrant scatter plot."),
            parameters={
                "type": "object",
                "properties": _date_range_params(),
                "required": ["start_date", "end_date"],
            },
        ),
    ])
]


# ---------------------------------------------------------------------------
# Self-test — run `python tools.py` to smoke-test every tool
# ---------------------------------------------------------------------------


def _self_test() -> None:
    def header(name: str) -> None:
        print(f"\n=== {name} ===")

    header("describe_data")
    desc = describe_data()
    print(f"window:       {desc['time_window']['start']} .. {desc['time_window']['end']}")
    print(f"categories:   {desc['categories']}")
    print(f"regions:      {desc['regions']}")
    print(f"transactions: {desc['total_transactions']}")

    header("get_kpi_summary (full window)")
    print(get_kpi_summary("2026-02-20", "2026-04-20"))

    header("get_sales_over_time (weekly by category) — first 5")
    for r in get_sales_over_time("2026-02-20", "2026-04-20", "week", "category")[:5]:
        print(r)

    header("get_sales_by_dimension (region)")
    for r in get_sales_by_dimension("2026-02-20", "2026-04-20", "region"):
        print(r)

    header("get_top_products (n=5, with growth, last month vs prior month)")
    for r in get_top_products("2026-03-21", "2026-04-20", n=5, with_growth=True):
        print(r)

    header("get_forecast_vs_actual (category)")
    for r in get_forecast_vs_actual("2026-02-20", "2026-04-20", "category"):
        print(r)

    header("get_product_pairs (top 5)")
    for r in get_product_pairs("2026-02-20", "2026-04-20", top_n=5):
        print(r)

    header("get_category_mix_by_channel")
    mix = get_category_mix_by_channel("2026-02-20", "2026-04-20")
    for ch, rows in mix.items():
        print(f"{ch}:")
        for r in rows:
            print(f"  {r}")


if __name__ == "__main__":
    _self_test()
