"""Gemini-backed analytical agent over the Walmart Data Ventures dataset.

Pattern: a basic tool-calling loop. The agent sees the same 13 functions
declared in tools.py as Gemini tools and decides which ones to call to
answer a user question. The loop terminates when the model returns text
instead of another tool call (or when MAX_ITERATIONS is hit).

Run as a CLI:
    python agent.py

Or import and call programmatically:
    from agent import ask_agent
    result = ask_agent("Which category missed forecast the most?")
    print(result["answer"])
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types

import tools

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
)
log = logging.getLogger("agent")


GEMINI_MODEL = "gemini-2.5-flash"
MAX_ITERATIONS = 10


# ---------------------------------------------------------------------------
# System prompt — encodes the agent's contract with the user
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a sales data analyst for the Walmart Data Ventures dashboard. You
answer questions about sales performance using only the tools available.

DATA SCOPE
- Time window: 2026-02-20 through 2026-04-20 (~2 months of simulated POS
  and ecommerce sales).
- 3 retail stores: ST001 (Rogers AR / South), ST002 (Los Angeles CA /
  West), ST003 (Chicago IL / Midwest).
- 1 fulfillment center: FC-EAST (Bethlehem PA / Northeast) — handles
  ecommerce delivery and ship orders.
- 4 categories: Cookies, Chips, Beverages, Dairy. 20 products total.
- Both forecasted and actual revenue/units are available.

RULES
1. ALWAYS use the tools. Never answer data questions from general knowledge
   or from your prior training.
2. NEVER invent numbers, dates, or product names. Only cite values
   returned by tool calls. If you compute a number (a delta, a percentage),
   show the inputs you used.
3. If a question falls outside the data scope — different time period,
   unavailable metric (e.g. profit margin including shipping, customer
   retention, weather), or different domain — say so plainly and suggest
   what IS available.
4. If a question is genuinely ambiguous ("are we doing well?", "how's
   business?"), ask one clarifying question before calling tools. Suggest
   the most likely angle: vs forecast, vs prior period, or absolute revenue.
   Do NOT treat missing parameters as ambiguity — fill them with sensible
   defaults. Specifically: if no date range is specified, use the full
   window 2026-02-20 to 2026-04-20. Note the assumption in your answer.
5. You may compute simple derivations from tool outputs (percentages,
   growth rates, ratios) as long as every input number came from a tool.
6. When unsure whether a question can be answered, call describe_data
   first to see what's available.

STYLE
- Lead with the answer. Cite specific dollar amounts, unit counts, and
  product names.
- Concise: 2-4 sentences typical. Use bullet lists when comparing 3+ items.
- Don't narrate your tool calls in the final answer — just give the analysis.
"""


# ---------------------------------------------------------------------------
# The agent loop
# ---------------------------------------------------------------------------


def ask_agent(question: str) -> dict[str, Any]:
    """Send a question to the agent and return {answer, trace, iterations}.

    The trace is a list of {tool, args, result_preview | error} entries —
    one per tool call, in order. Useful for displaying the agent's
    reasoning chain in the dashboard or for debugging.
    """
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    chat = client.chats.create(
        model=GEMINI_MODEL,
        config=genai_types.GenerateContentConfig(
            tools=tools.GEMINI_TOOLS,
            system_instruction=SYSTEM_PROMPT,
            # Keep thinking off — the tool-calling task is well-bounded and
            # we don't want thinking tokens eating into response quality.
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        ),
    )

    trace: list[dict[str, Any]] = []
    response = chat.send_message(question)

    for iteration in range(MAX_ITERATIONS):
        parts = response.candidates[0].content.parts
        function_calls = [p.function_call for p in parts if p.function_call]
        text_parts = [p.text for p in parts if getattr(p, "text", None)]

        if not function_calls:
            return {
                "answer": "".join(text_parts).strip() or "(no answer produced)",
                "trace": trace,
                "iterations": iteration + 1,
            }

        function_responses: list[genai_types.Part] = []
        for fc in function_calls:
            args = dict(fc.args) if fc.args else {}
            entry: dict[str, Any] = {"tool": fc.name, "args": args}
            try:
                fn = tools.DISPATCH[fc.name]
                result = fn(**args)
                entry["result_preview"] = _truncate(json.dumps(result, default=str), 300)
            except KeyError:
                result = {"error": f"unknown tool: {fc.name}"}
                entry["error"] = result["error"]
            except Exception as e:
                result = {"error": f"tool failed: {e}"}
                entry["error"] = str(e)

            trace.append(entry)
            log.info("tool %s(%s) -> %s", fc.name, args,
                     entry.get("error") or "ok")
            function_responses.append(
                genai_types.Part.from_function_response(
                    name=fc.name, response={"result": result}
                )
            )

        response = chat.send_message(function_responses)

    return {
        "answer": "Hit max iterations without producing a final answer.",
        "trace": trace,
        "iterations": MAX_ITERATIONS,
    }


def _truncate(s: str, n: int) -> str:
    return s if len(s) <= n else s[:n] + "..."


# ---------------------------------------------------------------------------
# CLI / REPL
# ---------------------------------------------------------------------------


def _print_trace(trace: list[dict[str, Any]]) -> None:
    if not trace:
        return
    print("--- tool calls ---")
    for i, entry in enumerate(trace, 1):
        args_str = ", ".join(f"{k}={v!r}" for k, v in entry["args"].items())
        print(f"  {i}. {entry['tool']}({args_str})")
        if "error" in entry:
            print(f"     error: {entry['error']}")


def main() -> None:
    print("Walmart Data Ventures — analytical agent")
    print("Type a question, or 'quit' to exit.\n")
    while True:
        try:
            question = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not question or question.lower() in {"quit", "exit"}:
            return

        result = ask_agent(question)
        print()
        _print_trace(result["trace"])
        print()
        print(result["answer"])
        print()


if __name__ == "__main__":
    main()
