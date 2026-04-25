"""End-to-end cleaning pipeline: raw POS + ecommerce --> clean `transactions`.

The pipeline runs in seven stages, each a named function you can walk through
in a presentation:

  1. load_raw               Read files, write them to the raw staging tables
  2. explode_ecommerce      Flatten nested orders into per-line-item rows
  3. normalize_schema       Bring POS + ecommerce onto a single column set
  4. deterministic_clean    Parse timestamps, dedup, fill missing store_ids
  5. resolve_products_ai    Use Gemini to map abbreviated POS strings -> UPCs
  6. join_reference_data    Enrich with product and store metadata
  7. load_transactions      Insert the clean analytical rows

The split between deterministic cleaning and AI resolution is deliberate: the
deterministic layer handles ~97% of rows cheaply and reproducibly, and the AI
layer is scoped to the narrow problem (abbreviated product strings) where
rule-based matching would require an ever-growing hand-maintained lookup.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone

import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types
from supabase import Client, create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
)
log = logging.getLogger("pipeline")


GEMINI_MODEL = "gemini-2.5-flash"
POS_CSV_PATH = "data/raw_pos.csv"
ECOM_JSON_PATH = "data/raw_ecommerce.json"
INSERT_CHUNK_SIZE = 500  # keeps each PostgREST request body well under limits


# ---------------------------------------------------------------------------
# Stage 1: load raw data into staging tables
# ---------------------------------------------------------------------------


def load_raw(client: Client) -> tuple[pd.DataFrame, list[dict]]:
    """Read both raw files and mirror them into the Supabase staging tables.

    Populating staging before cleaning is what lets the demo show a before/
    after contrast: the PM can run one query against `raw_pos_transactions`
    and see the dirty abbreviations, then run the same join against
    `transactions` and see them resolved.
    """
    # dtype=str on upc_or_name preserves leading zeros and stops pandas from
    # coercing UPC columns to floats (which silently drops the leading zero).
    pos_df = pd.read_csv(
        POS_CSV_PATH,
        dtype={"transaction_id": str, "store_id": str, "timestamp_raw": str,
               "upc_or_name": str},
    )
    with open(ECOM_JSON_PATH) as f:
        ecom_orders = json.load(f)

    _insert_raw_pos(client, pos_df)
    _insert_raw_ecom(client, ecom_orders)

    log.info("Stage 1: loaded %d POS rows and %d ecommerce orders into staging",
             len(pos_df), len(ecom_orders))
    return pos_df, ecom_orders


def _insert_raw_pos(client: Client, pos_df: pd.DataFrame) -> None:
    rows = pos_df.to_dict(orient="records")
    _chunked_insert(client, "raw_pos_transactions", rows)


def _insert_raw_ecom(client: Client, orders: list[dict]) -> None:
    rows = [
        {
            "order_id": o["order_id"],
            "placed_at": o["placed_at"],
            "customer_id": o["customer"]["id"],
            "loyalty_tier": o["customer"]["loyalty_tier"],
            "items_json": o["items"],  # supabase-py serializes dict/list to JSONB
            "fulfillment": o["fulfillment"],
            "store_id": o["store_id"],
        }
        for o in orders
    ]
    _chunked_insert(client, "raw_ecommerce_orders", rows)


def _chunked_insert(client: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), INSERT_CHUNK_SIZE):
        client.table(table).insert(rows[i:i + INSERT_CHUNK_SIZE]).execute()


# ---------------------------------------------------------------------------
# Stage 2: flatten ecommerce orders into line items
# ---------------------------------------------------------------------------


def explode_ecommerce(orders: list[dict]) -> pd.DataFrame:
    """One row per line item. transaction_id is order_id + item index so it
    is stable across reruns and unique across the ecommerce channel."""
    rows: list[dict] = []
    for order in orders:
        for i, item in enumerate(order["items"]):
            rows.append({
                "transaction_id": f"ECOM-{order['order_id']}-{i}",
                "order_id": order["order_id"],
                "product_identifier": item["sku"],
                "quantity": item["qty"],
                "sale_price_cents": item["unit_price_cents"],
                "sale_timestamp_raw": order["placed_at"],
                "store_id": order["store_id"],
                "customer_id": order["customer"]["id"],
                "channel": "ecommerce",
            })
    df = pd.DataFrame(rows)
    log.info("Stage 2: exploded %d orders into %d line items", len(orders), len(df))
    return df


# ---------------------------------------------------------------------------
# Stage 3: normalize POS and ecommerce onto one schema
# ---------------------------------------------------------------------------


def normalize_schema(pos_df: pd.DataFrame, ecom_df: pd.DataFrame) -> pd.DataFrame:
    """Bring both channels onto the same columns so the next stages can treat
    them uniformly.

    POS is anonymous (no customer) and is not grouped into orders, so we use
    transaction_id as its own order_id for schema symmetry.
    """
    pos_norm = pd.DataFrame({
        "transaction_id": pos_df["transaction_id"],
        "order_id": pos_df["transaction_id"],
        "product_identifier": pos_df["upc_or_name"],
        "quantity": pos_df["quantity"],
        "sale_price_cents": pos_df["price_charged_cents"],
        "sale_timestamp_raw": pos_df["timestamp_raw"],
        "store_id": pos_df["store_id"],
        "customer_id": None,
        "channel": "pos",
    })
    combined = pd.concat([pos_norm, ecom_df], ignore_index=True)
    log.info("Stage 3: normalized to %d rows across both channels", len(combined))
    return combined


# ---------------------------------------------------------------------------
# Stage 4: deterministic cleaning
# ---------------------------------------------------------------------------


def deterministic_clean(df: pd.DataFrame) -> pd.DataFrame:
    """Parse timestamps, drop exact duplicates, route null ecommerce store_ids
    to the fulfillment center.

    POS naive timestamps are treated as UTC for the prototype. In production
    we'd localize to the store's timezone before converting; that's a
    straightforward extension once the stores table carries a tz column.
    """
    before = len(df)

    df["sale_timestamp"] = df["sale_timestamp_raw"].apply(_parse_timestamp)
    df["sale_date"] = df["sale_timestamp"].dt.date

    df = df.drop_duplicates(
        subset=["transaction_id", "product_identifier", "store_id"]
    ).reset_index(drop=True)
    removed = before - len(df)
    log.info("Stage 4a: removed %d duplicate rows", removed)

    ecom_null_mask = (df["channel"] == "ecommerce") & df["store_id"].isna()
    df.loc[ecom_null_mask, "store_id"] = "FC-EAST"
    log.info("Stage 4b: routed %d ecommerce rows with null store_id to FC-EAST",
             int(ecom_null_mask.sum()))

    df.attrs["duplicates_removed"] = removed
    return df


def _parse_timestamp(raw: str) -> pd.Timestamp:
    """Accept the two POS formats and ISO 8601 from ecommerce; return UTC."""
    # ISO 8601 with Z (ecommerce) — most common, try first
    if "T" in raw:
        return pd.Timestamp(raw).tz_convert("UTC")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%m/%d/%Y %H:%M"):
        try:
            naive = datetime.strptime(raw, fmt)
            return pd.Timestamp(naive.replace(tzinfo=timezone.utc))
        except ValueError:
            continue
    raise ValueError(f"Unrecognized timestamp format: {raw!r}")


# ---------------------------------------------------------------------------
# Stage 5: AI product resolution
# ---------------------------------------------------------------------------


PRODUCT_RESOLUTION_PROMPT = """\
You are a product matching assistant. Given a raw product string and a catalog of valid products, return the product_id that best matches, or "UNKNOWN" if no confident match exists.

Raw string: {identifier}
Catalog:
{catalog}

Respond with only the product_id, nothing else."""


def resolve_products_with_ai(
    df: pd.DataFrame,
    products_df: pd.DataFrame,
    gemini_client: genai.Client,
) -> pd.DataFrame:
    """Resolve abbreviations and misspellings in product_identifier by asking
    Gemini which catalog product_id they correspond to.

    Rows whose product_identifier already matches a real UPC skip the API
    call entirely. Unique unmatched strings are resolved once and cached, so
    even thousands of duplicated dirty rows only cost one call per variant.
    """
    valid_ids = set(products_df["product_id"])
    unmatched = sorted(set(df["product_identifier"]) - valid_ids)

    if not unmatched:
        log.info("Stage 5: no unmatched identifiers; skipping AI resolution")
        df.attrs["ai_resolutions"] = 0
        df.attrs["unknown_dropped"] = 0
        return df

    catalog_lines = "\n".join(
        f"- {row.product_id}: {row.product_name} ({row.category})"
        for row in products_df.itertuples()
    )
    name_by_id = dict(zip(products_df["product_id"], products_df["product_name"]))

    resolution: dict[str, str] = {}
    for identifier in unmatched:
        product_id = _call_gemini_for_resolution(
            gemini_client, identifier, catalog_lines
        )
        resolution[identifier] = product_id
        if product_id != "UNKNOWN":
            print(f"AI resolved '{identifier}' -> '{product_id}' "
                  f"({name_by_id[product_id]})")
        else:
            print(f"AI could not resolve '{identifier}'")

    df["product_identifier"] = df["product_identifier"].map(
        lambda v: resolution.get(v, v)
    )
    before = len(df)
    df = df[df["product_identifier"] != "UNKNOWN"].reset_index(drop=True)
    dropped = before - len(df)

    resolved_count = sum(1 for v in resolution.values() if v != "UNKNOWN")
    log.info("Stage 5: resolved %d/%d unique identifiers, dropped %d UNKNOWN rows",
             resolved_count, len(unmatched), dropped)
    df.attrs["ai_resolutions"] = resolved_count
    df.attrs["unknown_dropped"] = dropped
    return df


def _call_gemini_for_resolution(
    client: genai.Client, identifier: str, catalog_lines: str
) -> str:
    """One call with one retry. Any failure past that maps to UNKNOWN so a
    flaky API never blocks the pipeline — those rows get dropped instead."""
    prompt = PRODUCT_RESOLUTION_PROMPT.format(
        identifier=identifier, catalog=catalog_lines
    )
    # Gemini 2.5 Flash has thinking mode enabled by default. For this narrow
    # classification task we don't need reasoning tokens — and with only 50
    # output tokens allowed, thinking would starve the actual answer. Disable
    # it explicitly so the full budget goes to the product_id output.
    config = genai_types.GenerateContentConfig(
        temperature=0,
        max_output_tokens=50,
        thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
    )
    for attempt in (1, 2):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config,
            )
            return response.text.strip()
        except Exception as e:
            log.warning("Gemini call failed (attempt %d) for %r: %s",
                        attempt, identifier, e)
            if attempt == 1:
                time.sleep(1)
    return "UNKNOWN"


# ---------------------------------------------------------------------------
# Stage 6: join reference data
# ---------------------------------------------------------------------------


def join_reference_data(
    df: pd.DataFrame,
    products_df: pd.DataFrame,
    stores_df: pd.DataFrame,
) -> pd.DataFrame:
    """Denormalize product_name, category, and region onto each row; convert
    cent-integers to dollar-decimals to match the transactions column types."""
    df = df.merge(
        products_df[["product_id", "product_name", "category", "unit_price_cents"]],
        left_on="product_identifier",
        right_on="product_id",
        how="inner",
    )
    df = df.merge(
        stores_df[["store_id", "region"]],
        on="store_id",
        how="left",
    )

    df["unit_price"] = (df["unit_price_cents"] / 100.0).round(2)
    df["sale_price"] = (df["sale_price_cents"] / 100.0).round(2)

    log.info("Stage 6: joined reference data; %d rows ready for load", len(df))
    return df


# ---------------------------------------------------------------------------
# Stage 7: load into clean transactions table
# ---------------------------------------------------------------------------


def load_transactions(client: Client, df: pd.DataFrame) -> int:
    """Insert final rows into the analytical table. Plain inserts — resets
    are handled by re-running supabase_setup.sql, not by the pipeline."""
    rows = [
        {
            "transaction_id": r["transaction_id"],
            "order_id": r["order_id"],
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "category": r["category"],
            "sale_date": r["sale_date"].isoformat(),
            "sale_timestamp": r["sale_timestamp"].isoformat(),
            "quantity": int(r["quantity"]),
            "unit_price": float(r["unit_price"]),
            "sale_price": float(r["sale_price"]),
            "store_id": r["store_id"],
            "region": r["region"],
            "customer_id": r["customer_id"],
            "channel": r["channel"],
        }
        for _, r in df.iterrows()
    ]
    _chunked_insert(client, "transactions", rows)
    log.info("Stage 7: inserted %d clean transaction rows", len(rows))
    return len(rows)


# ---------------------------------------------------------------------------
# Reference data fetchers + orchestration
# ---------------------------------------------------------------------------


def _fetch_table(client: Client, table: str) -> pd.DataFrame:
    response = client.table(table).select("*").execute()
    return pd.DataFrame(response.data)


def main() -> None:
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    gemini_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    pos_df, ecom_orders = load_raw(supabase)
    ecom_df = explode_ecommerce(ecom_orders)
    combined = normalize_schema(pos_df, ecom_df)
    cleaned = deterministic_clean(combined)

    products_df = _fetch_table(supabase, "products")
    stores_df = _fetch_table(supabase, "stores")

    resolved = resolve_products_with_ai(cleaned, products_df, gemini_client)
    enriched = join_reference_data(resolved, products_df, stores_df)
    final_count = load_transactions(supabase, enriched)

    print()
    print("=== Pipeline Summary ===")
    print(f"Raw POS rows:             {len(pos_df):>6}")
    print(f"Raw ecommerce orders:     {len(ecom_orders):>6}")
    print(f"Line items after explode: {len(ecom_df):>6}")
    print(f"Duplicates removed:       {cleaned.attrs.get('duplicates_removed', 0):>6}")
    print(f"AI resolutions made:      {resolved.attrs.get('ai_resolutions', 0):>6}")
    print(f"Rows dropped (unknown):   {resolved.attrs.get('unknown_dropped', 0):>6}")
    print(f"Final transactions:       {final_count:>6}")
    print("========================")


if __name__ == "__main__":
    main()
