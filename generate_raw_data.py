"""Generate simulated raw sales data with realistic quality issues.

Writes two files the pipeline consumes:

  * data/raw_pos.csv          ~1000 rows across 3 retail stores
  * data/raw_ecommerce.json   ~300 orders, nested items arrays

The POS file is deliberately dirty — mixed timestamp formats, exact-duplicate
rows, and ~3% of rows use abbreviated product names instead of UPCs. Those
abbreviations are the whole point of the AI resolution stage in pipeline.py.

The ecommerce JSON is clean (SKUs always match products.product_id) because
the dirty-input story is a POS-side phenomenon: manual register entry is where
abbreviations creep in, not the e-commerce storefront.
"""

from __future__ import annotations

import csv
import json
import logging
import os
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from faker import Faker

from seed_reference_tables import PRODUCT_CATALOG, STORES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
)
log = logging.getLogger("generate")


# ---------------------------------------------------------------------------
# Knobs — tune here if you want different volumes or ratios
# ---------------------------------------------------------------------------

POS_ROW_COUNT = 1000
ECOM_ORDER_COUNT = 300
WINDOW_START = datetime(2026, 2, 20, 0, 0, 0)
WINDOW_END = datetime(2026, 4, 20, 23, 59, 59)

DIRTY_VARIANT_RATE = 0.03  # ~3% of POS rows use an abbreviation
DUPLICATE_RATE = 0.05  # ~5% of POS rows are exact duplicates
AMBIGUOUS_TIMESTAMP_RATE = 0.30  # 30% use MM/DD/YYYY HH:MM format
RANDOM_PROMO_DISCOUNT_RATE = 0.10  # 10% of rows get a promo discount
BEVERAGE_PROMO_WEEK_START = date(2026, 3, 16)  # Mon of the promo week

# Dirty variants that a POS register might have keyed in manually. Each maps
# unambiguously to exactly one product_id in the catalog — the AI resolution
# step's job is to recover that mapping.
DIRTY_VARIANTS: dict[str, str] = {
    "GV WHL MLK 1GL": "078742083421",
    "GV 2% MLK 1GL": "078742083438",
    "OREO CKE 14OZ": "044000032029",
    "COKE 12PK": "049000028911",
    "LAYS CLSSC 8OZ": "028400090513",
    "DORITOS NCHO 9Z": "028400420624",
    "CHPS AHOY 13": "044000032074",
    "SPRITE 2L": "049000050103",
}

RETAIL_STORE_IDS = [s["store_id"] for s in STORES if s["store_type"] == "retail"]
PRODUCT_BY_ID = {p.product_id: p for p in PRODUCT_CATALOG}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _random_timestamp() -> datetime:
    """Uniformly random datetime in the simulation window."""
    total_seconds = int((WINDOW_END - WINDOW_START).total_seconds())
    return WINDOW_START + timedelta(seconds=random.randint(0, total_seconds))


def _format_timestamp(ts: datetime) -> str:
    """Pick one of two formats with the configured ratio, matching what real
    POS systems do when different register models serialize differently."""
    if random.random() < AMBIGUOUS_TIMESTAMP_RATE:
        return ts.strftime("%m/%d/%Y %H:%M")
    return ts.strftime("%Y-%m-%d %H:%M:%S")


def _in_beverage_promo_week(ts: datetime) -> bool:
    monday = BEVERAGE_PROMO_WEEK_START
    return monday <= ts.date() < monday + timedelta(days=7)


def _price_with_maybe_discount(retail_cents: int, force_discount: bool = False) -> int:
    """Base retail, optionally discounted by 10–20%. force_discount=True is
    used during the beverage promo week so every beverage row is on promo."""
    if force_discount or random.random() < RANDOM_PROMO_DISCOUNT_RATE:
        discount = random.uniform(0.10, 0.20)
        return int(round(retail_cents * (1 - discount)))
    return retail_cents


# ---------------------------------------------------------------------------
# POS generator
# ---------------------------------------------------------------------------


def generate_pos_rows() -> list[dict]:
    """Build the POS rows list. Exact-duplicate rows are appended afterwards
    so the pipeline's dedup stage has something to remove."""
    rows: list[dict] = []

    for _ in range(POS_ROW_COUNT):
        store_id = random.choice(RETAIL_STORE_IDS)
        ts = _random_timestamp()

        if random.random() < DIRTY_VARIANT_RATE:
            # Pick an abbreviation; price it using the real product it maps to.
            variant = random.choice(list(DIRTY_VARIANTS.keys()))
            product = PRODUCT_BY_ID[DIRTY_VARIANTS[variant]]
            upc_or_name = variant
        else:
            product = random.choice(PRODUCT_CATALOG)
            upc_or_name = product.product_id

        promo_active = product.category == "Beverages" and _in_beverage_promo_week(ts)
        quantity = random.randint(1, 3)
        if promo_active:
            quantity = max(1, int(round(quantity * 1.5)))  # +50% volume bump
        price_cents = _price_with_maybe_discount(
            product.retail_cents, force_discount=promo_active
        )

        rows.append(
            {
                "transaction_id": f"POS-{store_id}-{uuid.uuid4().hex[:10]}",
                "store_id": store_id,
                "timestamp_raw": _format_timestamp(ts),
                "upc_or_name": upc_or_name,
                "quantity": quantity,
                "price_charged_cents": price_cents,
            }
        )

    # Simulate a POS retry bug: 5% of rows get re-emitted verbatim.
    dup_count = int(round(POS_ROW_COUNT * DUPLICATE_RATE))
    duplicates = [dict(r) for r in random.sample(rows, dup_count)]
    rows.extend(duplicates)
    random.shuffle(rows)
    return rows


def write_pos_csv(rows: list[dict], path: str) -> None:
    fieldnames = [
        "transaction_id",
        "store_id",
        "timestamp_raw",
        "upc_or_name",
        "quantity",
        "price_charged_cents",
    ]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    log.info("Wrote %d POS rows (incl. duplicates) to %s", len(rows), path)


# ---------------------------------------------------------------------------
# Ecommerce generator
# ---------------------------------------------------------------------------


LOYALTY_WEIGHTS = [(None, 0.30), ("basic", 0.40), ("plus", 0.20), ("premium", 0.10)]
FULFILLMENT_WEIGHTS = [("delivery", 0.60), ("pickup", 0.30), ("ship", 0.10)]
PROMO_CODES = ["SPRING10", "LOYALTY15", "SAVE20", "NEWCUST"]


def _weighted_choice(weighted: list[tuple]) -> object:
    values, weights = zip(*weighted)
    return random.choices(values, weights=weights, k=1)[0]


def generate_ecommerce_orders(fake: Faker) -> list[dict]:
    """Build the ecommerce order list — one entry per order, items nested."""
    orders: list[dict] = []

    for _ in range(ECOM_ORDER_COUNT):
        ts = _random_timestamp().replace(tzinfo=timezone.utc)
        fulfillment = _weighted_choice(FULFILLMENT_WEIGHTS)
        loyalty_tier = _weighted_choice(LOYALTY_WEIGHTS)
        customer_id = f"c_{fake.random_number(digits=6, fix_len=True)}"

        # Only pickup orders carry a real store_id; delivery and ship leave it
        # null and the pipeline maps them to FC-EAST.
        store_id = random.choice(RETAIL_STORE_IDS) if fulfillment == "pickup" else None

        item_count = random.randint(1, 4)
        items = []
        chosen_products = random.sample(PRODUCT_CATALOG, item_count)
        for product in chosen_products:
            promo_code = random.choice(PROMO_CODES) if random.random() < 0.15 else None
            unit_price_cents = _price_with_maybe_discount(product.retail_cents)
            items.append(
                {
                    "sku": product.product_id,
                    "qty": random.randint(1, 3),
                    "unit_price_cents": unit_price_cents,
                    "promo_code": promo_code,
                }
            )

        orders.append(
            {
                "order_id": f"WM-2026-{fake.random_number(digits=7, fix_len=True)}",
                "placed_at": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "customer": {"id": customer_id, "loyalty_tier": loyalty_tier},
                "items": items,
                "fulfillment": fulfillment,
                "store_id": store_id,
            }
        )
    return orders


def write_ecommerce_json(orders: list[dict], path: str) -> None:
    with open(path, "w") as f:
        json.dump(orders, f, indent=2)
    log.info("Wrote %d ecommerce orders to %s", len(orders), path)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def main() -> None:
    random.seed(42)
    fake = Faker()
    Faker.seed(42)

    os.makedirs("data", exist_ok=True)
    pos_rows = generate_pos_rows()
    write_pos_csv(pos_rows, "data/raw_pos.csv")

    ecom_orders = generate_ecommerce_orders(fake)
    write_ecommerce_json(ecom_orders, "data/raw_ecommerce.json")

    log.info("Raw data generation complete.")


if __name__ == "__main__":
    main()
