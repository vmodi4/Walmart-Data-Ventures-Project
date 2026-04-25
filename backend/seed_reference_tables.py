"""Seed suppliers, stores, products, and forecasts into Supabase.

Run once after supabase_setup.sql has created the schema. This populates the
reference layer that the pipeline joins against when enriching raw sales data.

The PRODUCT_CATALOG constant at module scope is the single source of truth for
product metadata (UPC, name, category, wholesale + retail prices, supplier).
generate_raw_data.py imports it to keep the simulated sales data internally
consistent with the seeded products table.
"""

from __future__ import annotations

import logging
import os
import random
from dataclasses import dataclass
from datetime import date, timedelta

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
)
log = logging.getLogger("seed")


# ---------------------------------------------------------------------------
# Canonical reference data
# ---------------------------------------------------------------------------

SUPPLIERS: list[dict] = [
    {"supplier_id": 1, "supplier_name": "Mondelez International",
     "contact_email": "orders@mondelez.example", "region": "Northeast"},
    {"supplier_id": 2, "supplier_name": "Frito-Lay",
     "contact_email": "orders@fritolay.example", "region": "South"},
    {"supplier_id": 3, "supplier_name": "Coca-Cola Company",
     "contact_email": "orders@coca-cola.example", "region": "South"},
    {"supplier_id": 4, "supplier_name": "Dean Foods",
     "contact_email": "orders@deanfoods.example", "region": "Midwest"},
    {"supplier_id": 5, "supplier_name": "Kellogg's",
     "contact_email": "orders@kelloggs.example", "region": "Midwest"},
]

STORES: list[dict] = [
    {"store_id": "ST001", "store_name": "Walmart Supercenter Rogers",
     "city": "Rogers", "state": "AR", "region": "South", "store_type": "retail"},
    {"store_id": "ST002", "store_name": "Walmart Supercenter Los Angeles",
     "city": "Los Angeles", "state": "CA", "region": "West", "store_type": "retail"},
    {"store_id": "ST003", "store_name": "Walmart Supercenter Chicago",
     "city": "Chicago", "state": "IL", "region": "Midwest", "store_type": "retail"},
    {"store_id": "FC-EAST", "store_name": "Walmart Fulfillment Center East",
     "city": "Bethlehem", "state": "PA", "region": "Northeast",
     "store_type": "fulfillment_center"},
]


@dataclass(frozen=True)
class Product:
    product_id: str           # UPC as string; leading zeros matter
    product_name: str
    category: str
    wholesale_cents: int      # seeded into products.unit_price_cents
    retail_cents: int         # used by generate_raw_data.py only
    supplier_id: int


PRODUCT_CATALOG: list[Product] = [
    # --- Cookies ---
    Product("044000032029", "Oreo Original 14.3oz",          "Cookies",   249, 398, 1),
    Product("044000032036", "Oreo Double Stuf 14.3oz",       "Cookies",   249, 398, 1),
    Product("044000032074", "Chips Ahoy Original 13oz",      "Cookies",   235, 378, 1),
    Product("030100212102", "Keebler Chips Deluxe 11.3oz",   "Cookies",   220, 348, 5),
    Product("078742351230", "Great Value Chocolate Chip 18oz","Cookies",  185, 298, 1),
    # --- Chips ---
    Product("028400090513", "Lays Classic 8oz",              "Chips",     270, 429, 2),
    Product("028400420624", "Doritos Nacho Cheese 9.25oz",   "Chips",     345, 549, 2),
    Product("028400090919", "Ruffles Original 8oz",          "Chips",     270, 429, 2),
    Product("028400090216", "Cheetos Crunchy 8.5oz",         "Chips",     310, 499, 2),
    Product("028400090711", "Tostitos Scoops 10oz",          "Chips",     310, 499, 2),
    # --- Beverages ---
    Product("049000028911", "Coca-Cola 12pk",                "Beverages", 440, 699, 3),
    Product("049000028928", "Diet Coke 12pk",                "Beverages", 440, 699, 3),
    Product("049000050103", "Sprite 2L",                     "Beverages", 155, 249, 3),
    Product("049000042566", "Dasani Water 24pk",             "Beverages", 375, 598, 3),
    Product("025000045219", "Minute Maid OJ 59oz",           "Beverages", 250, 398, 3),
    # --- Dairy ---
    Product("078742083421", "Great Value Whole Milk 1gal",   "Dairy",     220, 348, 4),
    Product("078742083438", "Great Value 2% Milk 1gal",      "Dairy",     220, 348, 4),
    Product("742365021022", "Horizon Organic Milk 64oz",     "Dairy",     310, 498, 4),
    Product("070470006789", "Yoplait Strawberry 6oz",        "Dairy",      42,  68, 4),
    Product("818290010018", "Chobani Greek Vanilla 5.3oz",   "Dairy",      80, 128, 4),
]


# ---------------------------------------------------------------------------
# Seed functions
# ---------------------------------------------------------------------------


def get_supabase_client() -> Client:
    """Build a Supabase client from SUPABASE_URL + SUPABASE_KEY env vars."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    return create_client(url, key)


def seed_suppliers(client: Client) -> None:
    """Insert the 5 supplier rows that products reference."""
    client.table("suppliers").insert(SUPPLIERS).execute()
    log.info("Seeded %d suppliers", len(SUPPLIERS))


def seed_stores(client: Client) -> None:
    """Insert 3 retail stores + 1 fulfillment center.

    FC-EAST catches ecommerce delivery/ship orders that arrive without a
    store_id; the pipeline's deterministic cleaning stage maps those nulls to
    this location so every transaction has a valid store reference.
    """
    client.table("stores").insert(STORES).execute()
    log.info("Seeded %d stores", len(STORES))


def seed_products(client: Client) -> None:
    """Insert the 20-product catalog. UPCs are stored as TEXT to preserve
    leading zeros (they would silently disappear if treated as integers)."""
    rows = [
        {
            "product_id": p.product_id,
            "product_name": p.product_name,
            "category": p.category,
            "unit_price_cents": p.wholesale_cents,
            "supplier_id": p.supplier_id,
        }
        for p in PRODUCT_CATALOG
    ]
    client.table("products").insert(rows).execute()
    log.info("Seeded %d products", len(rows))


def _baseline_units(category: str) -> int:
    """Plausible weekly baseline units per product per store, by category.

    Calibrated against generated POS+ecommerce volume (~4 units per
    product-store-week on average). Beverages get a slight bump because of
    the promo-week demand; Dairy is a touch lower because of smaller
    single-serve units (yogurt) dominating that category.
    """
    if category == "Beverages":
        return random.randint(4, 7)
    if category in ("Cookies", "Chips"):
        return random.randint(3, 6)
    return random.randint(3, 5)  # Dairy


def _forecast_weeks() -> list[date]:
    """Weekly week_start dates covering 2026-02-16 .. 2026-04-20 (10 weeks)."""
    start = date(2026, 2, 16)  # Monday
    return [start + timedelta(weeks=i) for i in range(10)]


def seed_forecasts(client: Client) -> None:
    """Weekly forecasts per (product, store) pair, including FC-EAST.

    Baseline units vary by category; a +/-15% jitter per cell keeps the
    Forecast-vs-Actual chart from looking flat. Deterministic via random.seed.
    """
    random.seed(42)
    weeks = _forecast_weeks()
    rows: list[dict] = []
    for product in PRODUCT_CATALOG:
        for store in STORES:
            for week_start in weeks:
                base = _baseline_units(product.category)
                units = max(1, int(base * random.uniform(0.85, 1.15)))
                revenue = round(units * product.retail_cents / 100.0, 2)
                rows.append({
                    "product_id": product.product_id,
                    "store_id": store["store_id"],
                    "week_start": week_start.isoformat(),
                    "forecasted_units": units,
                    "forecasted_revenue": revenue,
                })
    # Chunked inserts keep each request well under PostgREST body limits.
    for i in range(0, len(rows), 500):
        client.table("forecasts").insert(rows[i:i + 500]).execute()
    log.info("Seeded %d forecast rows (%d products x %d stores x %d weeks)",
             len(rows), len(PRODUCT_CATALOG), len(STORES), len(weeks))


def main() -> None:
    client = get_supabase_client()
    seed_suppliers(client)
    seed_stores(client)
    seed_products(client)
    seed_forecasts(client)
    log.info("Reference seed complete.")


if __name__ == "__main__":
    main()
