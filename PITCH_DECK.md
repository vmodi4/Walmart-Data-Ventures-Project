# Pitch Deck — Walmart Data Ventures

A slide-by-slide outline for the PM-team presentation. Each slide has a
title, what to put on it visually, and a talk track to memorize the gist of.

**Structure:**

- **Part 1 — The Build** (10 slides). Walk through the system bottom-up:
  raw data → cleaning → schema → tech stack → tools layer → dashboard → agent.
- **Part 2 — How I Did It & What Bit Me** (6 slides). Methodology, working
  with the design partner, the pitfalls, takeaways.

Target length: **22-25 minutes content + 5 minutes demo + Q&A**. 16 slides total.

---

# PART 1 — THE BUILD (10 slides)

### Slide 1 — Title

**Visual:**
> Building an AI-Assisted Sales Analytics Pipeline for Walmart Data Ventures
>
> Vignesh Modigunta

**Talk track:**
> Today I'm going to walk you through a prototype I built end-to-end —
> a sales data pipeline, a database, a backend API, a dashboard, and an
> AI agent — and then talk about how I built it, what worked, and the
> specific things that bit me along the way. The first half is the
> system. The second half is the lessons.

---

### Slide 2 — What I built (overview)

**Visual:** the system diagram, top to bottom.
```
   raw POS CSV ─┐
                ├─► CLEANING ──► SUPABASE ──► FASTAPI ──┬──► V0 DASHBOARD
   raw ecom JSON ┘   (Python)    (Postgres)             │
                       ▲                                └──► AI AGENT
                  AI product
                  resolution
                  (Gemini)
```
Caption: 1 week build, 5 layers, ~2,000 lines of code.

**Talk track:**
> Bird's-eye view of the whole thing. Two messy raw files come in — a
> POS CSV with mixed timestamp formats and abbreviated product names,
> and a nested ecommerce JSON with delivery orders that have no store
> ID. They go through a Python cleaning pipeline. The cleaned rows
> land in Postgres on Supabase. A FastAPI backend exposes 14 endpoints
> on top of that data. A V0-generated dashboard reads those endpoints,
> and a Gemini-powered AI agent answers natural-language questions
> using the same set of tools.
>
> Total time: about a week. We'll work bottom-up.

---

### Slide 3 — Raw data: what comes in

**Visual:** side-by-side excerpts of the actual files.
```
raw_pos.csv                                  raw_ecommerce.json
─────────────────                            ──────────────────────
transaction_id, store_id, timestamp_raw,     {
upc_or_name, quantity, price_charged_cents     "order_id": "WM-2026-...",
                                                "placed_at": "2026-03-15T...",
POS-ST002-a3f2..., ST002, "GV WHL MLK 1GL",     "customer": {"id": "c_938...",
2026-03-15 14:22:10, 1, 348                                  "loyalty_tier": "plus"},
POS-ST001-..., ST001, OREO CKE 14OZ,            "items": [{"sku": "...", ...}],
03/15/2026 14:22, 2, 398                        "fulfillment": "delivery",
                                                "store_id": null
                                              }
```

**Talk track:**
> The raw data is deliberately messy in the same ways real Walmart
> data is messy. POS rows have *mixed timestamp formats* — some ISO,
> some MM/DD/YYYY — because different register models serialize
> differently. Some rows use the actual UPC; some use abbreviated
> register entries like "GV WHL MLK 1GL" because someone keyed it in
> manually. About 5% of rows are exact duplicates from POS retry bugs.
>
> The ecommerce JSON is nested — orders contain item arrays — and
> delivery orders have a null `store_id` because they ship from a
> fulfillment center, not a retail store.
>
> Both feeds need to land in the same clean analytical table. That's
> what the pipeline does.

---

### Slide 4 — Cleaning Stage 1: deterministic

**Visual:** four bullet boxes, one per cleaning step.
```
1. Parse timestamps     2. Dedup on
   try ISO → fallback      transaction_id +
   MM/DD/YYYY              product + store
                           (~5% removed)

3. Normalize prices     4. Route null store_ids
   cents → dollars         ecom delivery/ship
                           → FC-EAST
```
Caption: handles ~97% of rows. $0/call. Reproducible.

**Talk track:**
> Cleaning happens in two stages. The first is deterministic Python —
> the boring stuff that pandas can do reliably. Parse the two
> timestamp formats. Drop exact duplicates. Convert cents to dollars.
> When an ecommerce order has no store ID — because it shipped, not
> picked up — assign it to the fulfillment center.
>
> This stage handles 97% of the rows for free, fast, and
> deterministically. No AI in sight. The point is to do as much as
> possible with cheap reliable code before the AI layer kicks in.

---

### Slide 5 — Cleaning Stage 2: AI product resolution

**Visual:** before/after on a single row.
```
RAW:                          AI RESOLVED:
upc_or_name = "GV WHL MLK     product_id = "078742083421"
                1GL"          product_name = "Great Value
                                              Whole Milk 1gal"
```
With a caption: *3% of rows. ~$0.001/call. The job rule-based matching can't do.*

**Talk track:**
> Stage 2 is the AI step. About 3% of POS rows arrive with abbreviated
> names that aren't UPCs — and there's no rule-based way to map "GV
> WHL MLK 1GL" to its real product without a hand-maintained lookup
> table that grows forever.
>
> So we ask Gemini. For each unmatched identifier, the cleaning
> pipeline sends a prompt with the catalog of valid products, and
> Gemini returns the correct product_id. Successful matches: 6 out of
> 8 unique abbreviations on the demo dataset. The other two get
> dropped — we'd rather drop a row than fabricate a wrong match.
>
> The principle here is "AI on rails": narrow scope, clear input,
> clear output, deterministic fallback. This is how every
> production-grade AI feature I respect is actually built.

---

### Slide 6 — Database schema: three layers

**Visual:** the three layers stacked.
```
┌─────────────────────────────────────────────────┐
│ CLEAN ANALYTICAL                                │
│  transactions                                   │
│   the unified, enriched output                  │
└─────────────────────────────────────────────────┘
        ▲ joined + denormalized
┌─────────────────────────────────────────────────┐
│ REFERENCE                                       │
│  suppliers, stores, products, forecasts         │
│   master data, seeded once                      │
└─────────────────────────────────────────────────┘
        ▲ enriches
┌─────────────────────────────────────────────────┐
│ RAW STAGING                                     │
│  raw_pos_transactions, raw_ecommerce_orders     │
│   data exactly as it arrived                    │
└─────────────────────────────────────────────────┘
```

**Talk track:**
> Three layers in the database, each with a single responsibility.
> Raw staging holds the data exactly as it landed — dirty, deduped,
> with original mixed timestamp formats. We keep that layer because
> if the cleaning code has a bug, we can re-run from raw without
> re-ingesting.
>
> Reference holds the master data: suppliers, stores, products, and
> the forecasted volumes. Seeded once at project start, rarely
> changes.
>
> Clean analytical is the table the dashboard and agent actually
> query. It's denormalized — every row carries product name,
> category, region — so reads are fast and the SQL stays simple.
>
> This three-layer pattern isn't novel; it's standard for any data
> pipeline. The reason to call it out is that the AI cleaning step
> only operates between layer 1 and layer 3. Layers 2 and 3 never
> see the model's output directly — they only see deterministic
> Python results that may *include* AI-resolved values, with a
> deterministic fallback if the AI failed.

---

### Slide 7 — Tech stack: minutes, not days

**Visual:** four-layer stack table.

| Layer | Tool | Why |
|---|---|---|
| Database | **Supabase** | Postgres + REST + auth in 5 min, free tier covers prototypes |
| Backend | **FastAPI** | Auto-generated OpenAPI docs, native async, Pydantic validation |
| AI | **Gemini 2.5 Flash** | Free tier, fast, reliable tool calling, low cost |
| Frontend | **V0 + shadcn/ui** | AI-generated React with consistent design system |

**Talk track:**
> Each of these used to be a sprint of work. Now they're an afternoon.
> Supabase: I had a Postgres database with a REST API in five minutes,
> not two days. FastAPI: 14 endpoints with auto-generated interactive
> docs in an afternoon. Gemini: tool calling in 80 lines of Python.
> V0: a designer is producing real React code from prompts.
>
> The strategic point for product folks: ideas that used to need an
> engineer plus a sprint can now be a prototype by Friday. The
> bottleneck shifted from *time-to-build* to *clarity-of-idea*. If
> you have a clean idea, you can have a working artifact this week.
> If you don't, the tools won't save you.

---

### Slide 8 — One tool surface, two consumers

**Visual:** the architectural insight.
```
              ┌── @app.get("/kpi") ──────────► DASHBOARD
              │
def get_kpi_summary(start, end):
    # one Python function, one SQL query
              │
              └── Gemini tool call ──────────► AI AGENT
```
Caption: 13 functions × 2 wrappers = 26 capabilities for the cost of 13.

**Talk track:**
> Here's the architectural decision I'm proudest of. Instead of
> writing each analytical query twice — once for the dashboard, once
> for the agent — I wrote each one as a Python function in a single
> file, and wrapped that file two ways.
>
> FastAPI converts each function to a REST endpoint with one
> decorator. The Gemini SDK exposes each function as a tool the
> agent can call by name. Same Python function. Same SQL underneath.
> Same source of truth.
>
> When I add a chart, I add one Python function and both consumers
> get the capability. When I fix a bug, I fix it in one place. This
> pattern is genuinely the right answer for any product where humans
> and AI agents both need to read the same data spine — which, going
> forward, is most products.

---

### Slide 9 — The dashboard

**Visual:** screenshot of the V0 dashboard layout (or wireframe with the 11 components).

**Talk track:**
> The dashboard is what the PM team and the supplier reps would
> actually see. 11 components: KPI cards at the top, revenue and
> margin trends in the middle, regional and category breakdowns,
> forecast vs actual comparisons, a market basket view, and a daily
> sales heatmap.
>
> Built in V0 by my design partner. Each component is a React
> component that fetches from one of the FastAPI endpoints. The
> teal-accented "AI-Rescued Revenue" KPI is the prototype's unique
> visualization — it shows in dollars how much revenue the AI
> cleaning step preserved that rule-based matching would have
> dropped.

---

### Slide 10 — The AI agent

**Visual:** the loop diagram.
```
USER                 GEMINI                  TOOLS
─────                ──────                  ─────
"Which category   →
missed forecast?"
                    decides which tool
                    to call
                  →  function_call:        →
                     get_forecast_vs_actual
                                            runs SQL,
                                            returns rows
                  ←  function_response       ←
                    synthesizes answer
←  "Beverages missed
   by 9.3% at $4,482..."
```
Caption: ~80 lines of Python. No framework. Same 13 tools as the dashboard.

**Talk track:**
> The agent is a tool-calling loop, about 80 lines of Python. There's
> no framework, no LangChain, no SDK magic. The pattern is: send the
> user's question + the tool definitions to Gemini. Gemini returns
> either text — meaning it has an answer — or a structured request to
> call one of the tools. If it's a tool call, our code runs the
> matching Python function and sends the result back. Repeat until
> the model returns text.
>
> The model doesn't actually execute anything. It just decides which
> tool to call and with what arguments. We do the running. That's why
> the loop is so short.
>
> The same 13 tools that power the dashboard endpoints power the
> agent. Same data, same SQL, same source of truth. The agent is
> essentially a natural-language interface over the dashboard.

---

# PART 1.5 — DEMO (transitional)

### Slide 11 — Live demo

**Visual:** screenshot or "Demo" placeholder.

**Talk track:**
> Quick live walkthrough — about 4 minutes:
>
> 1. The raw POS CSV with abbreviated product names visible
> 2. The pipeline running, showing the AI resolving 6 of 8
>    abbreviations live in the terminal
> 3. The dashboard rendering the cleaned data
> 4. The agent answering "which category missed forecast the most?"
>    and showing its tool-call trace
> 5. The agent declining to answer "what's our profit margin
>    including shipping" because that data isn't in scope

(Rehearse this. Have a runbook with the exact questions. Don't ad-lib.)

---

# PART 2 — HOW I DID IT & WHAT BIT ME (5 slides)

### Slide 12 — Methodology: how I worked with Claude

**Visual:** workflow diagram.
```
1. CHAT-BASED LLM (Claude / ChatGPT)        2. CLAUDE CODE / CODEX
   Comprehensive plan                          Execute the plan
   "Be harsh — what would break?"              "Build this exact spec"
   Iterate until plan is bulletproof           ↓
   ↓                                           Working code
   Plan as document
```

**Talk track:**
> The single most important methodology shift was *not opening Claude
> Code first*. I'd open a chat interface — Claude or ChatGPT — and
> write a comprehensive plan. Schema, endpoints, cleaning stages, edge
> cases, all of it. Then I'd ask the LLM to be harsh on the plan —
> tell it to find what's missing, what could break, what assumptions I
> was making.
>
> LLMs are sycophantic by default. They will agree with a bad plan.
> You have to explicitly invite criticism. That pattern caught at
> least three issues here before I wrote a line of code: an ambiguous
> schema decision, a chart in the original design that the database
> couldn't support, and a missing edge case in the data generator.
> Each of those would have been half a day of rework if I'd built
> first and discovered later.
>
> Then — and only then — I'd hand the plan to Claude Code as a
> *constraint*, not a wish. "Build this specific thing." That's where
> the speed comes from. Claude Code with a tight plan ships in hours.
> Claude Code with a vague brief produces five days of rewrites.

---

### Slide 13 — Working with my design partner

**Visual:** parallel-track timeline.
```
Day 1               Day 2-4                  Day 5
─────               ───────                  ─────
Agree on            ┌─ Vignesh: build       Integration:
endpoint            │   API + agent          wire dashboard
shapes              │                        to real API
                    │
                    └─ Designer: V0          ~30 minutes,
                        components             not 2 days
                        with mock data
                        matching real
                        endpoint shapes
```

**Talk track:**
> Same principle, applied across people. Before either of us started
> building, we agreed on the data shapes — what JSON each endpoint
> returns, what fields, what types. I produced a `DESIGNER_HANDOFF.md`
> document with copy-paste-ready V0 prompts that included the exact
> response shape for each component.
>
> She designed in V0 against mock data that matched those shapes
> exactly. I built the API against the same contract. We met for
> integration on day 5, and it was 30 minutes of mechanical work to
> swap mock data for real fetch calls — not two days of "your
> component expects fields the API doesn't return."
>
> This is API-first development applied to design. The contract is
> the unblock. Define it first, build in parallel, integrate fast.

---

### Slide 14 — The new failure mode

**Visual:** large text:
> **The system returned a 200 OK.**
>
> **The numbers were wrong.**
>
> **Nothing told me out loud.**

**Talk track:**
> Now the harder lesson. In old-style development, when something
> went wrong, you got a stack trace, a 500 error, a console line.
> Loud failures. Easy to fix.
>
> AI systems and the modern tools they sit on top of fail *quietly*.
> The model returns plausible text that's wrong. The database
> returns 1000 rows when you asked for 1741. The API returns 200 OK
> with stale data. None of it shouts at you. You discover it when
> downstream numbers look weird, or when you happen to delete the
> table and notice the row count was different than you thought.
>
> The job of building reliably with AI is the job of *forcing those
> silent failures to be loud*. That's harder than it sounds, because
> you don't know what to look for until you've been bitten.

---

### Slide 15 — Concrete pitfalls

**Visual:** four pitfalls in a 2x2 grid.

| | |
|---|---|
| **Underspecified prompt** — Gemini returned `UNKNOWN` for `SPRITE 2L`, a product that's literally in the catalog. "Best matches" is a gesture, not a spec. | **Thinking budget trap** — Gemini returned the single character `'0'` instead of a product_id. `max_output_tokens=50` was eaten by internal reasoning before the answer ever rendered. |
| **PostgREST silent 1000-row cap** — dashboard reported $8K total revenue. Real number was $14K. Query returned 200 OK and silently truncated. | **"Free tier" means three different things** — quota=0 on one model, 5 RPM on another, RLS denying writes on a third. Same word, three failure modes. |

**Talk track:**
> Four pitfalls from this project — the full list is eight, in the
> repo as `PITFALLS.md`. Each one is a case where I had a plausible
> mental model, the system did something different, and nothing
> alerted me until downstream numbers looked off.
>
> The pattern: none of these are AI failures specifically. They're
> failures of *defaults*. The prompt's defaults, the model's
> defaults, the database's defaults, the vendor's billing defaults.
> Vibe-coding is fast partly because you accept defaults; that
> speed comes with the bill that those defaults will eventually
> disagree with you, quietly.
>
> Tracking these as a discipline — `PITFALLS.md` as a deliverable —
> turns implicit team knowledge into onboarding material and turns
> "the demo just works" into "the demo works because I caught these
> eight things."

---

### Slide 16 — Takeaways for PMs

**Visual:** numbered list, large type.
> 1. **Plan in chat before opening Claude Code.** Two hours of
>    planning saves five days of rebuilding.
> 2. **Tell the model to be harsh.** It will agree with you by default.
> 3. **Define data contracts before parallel work.** Same logic as
>    API contracts, applied to humans + AI.
> 4. **One tool surface, multiple consumers.** Build analytical logic
>    once, expose it many ways.
> 5. **AI on rails — deterministic first, AI for the last mile.**
>    This is the production pattern.
> 6. **Make silent failures loud.** Validate against ground truth, not
>    plausibility. Track pitfalls as a discipline.

**Talk track:**
> Six things to take back to your team. They generalize beyond this
> project — every AI product you ship will hit some version of all
> six. The team that ships AI features reliably will be the one that
> internalizes these as habits, not the one with the best access to
> models.
>
> Happy to take questions.

---

## Appendix — things to actively avoid in this deck

- **Don't lead with "AI is amazing."** Every PM in the room has heard
  that pitch. Lead with what you built and what was hard.
- **Don't skip the demo.** This entire talk lands stronger if there's
  a working live demo, even a 2-minute one. PMs trust working things
  over described things.
- **Don't use the word "agentic."** Marketing word, not technical.
  "Agent" is fine because it's accurate.
- **Don't claim AI replaces anything.** Frame it as "AI accelerates
  building; rigor moves to a different place."
- **Don't apologize for the simulated data.** Lead with "I simulated
  realistic data so the cleaning challenges are real" — the
  simulation is part of the rigor, not a limitation.

## Appendix — things to rehearse

- The **demo flow.** Have a runbook with exact questions and click
  order. Live demos fail when ad-libbed.
- The **SPRITE 2L story.** That's the most teachable concrete pitfall
  and recurs throughout. Get the framing tight.
- The **tech stack rationale slide (slide 7).** Don't read the table
  — talk to the strategic point at the bottom (the bottleneck shift).
- The **transition from Slide 11 (demo) to Slide 12 (methodology).**
  This is the hinge of the talk. Land it cleanly: "you've seen the
  artifact — here's how I built it that fast."
