# Pitch Deck — Walmart Data Ventures

A slide-by-slide outline for the PM-team presentation. Each slide has a
title, what to put on it visually, and a talk track to memorize the gist of.

The framing is **"vibe-coding pitfalls and how to manage AI-assisted
product work"** — not "look how cool AI is." That framing is durable
because PMs see ten AI demos a week and one honest post-mortem a month.

Target length: **20-25 minutes**, leaves room for ~10 minutes of Q&A
and demo. 15 slides total.

---

## ACT 1 — SETUP (3 slides)

### Slide 1 — Title

**Visual:**
> The Pitfalls of Vibe-Coding an AI Pipeline
> *Lessons from building a Walmart sales prototype, end to end, with AI*
>
> Vignesh Modigunta · Walmart Data Ventures

**Talk track:**
> Today I'm going to walk you through a prototype I built — a sales data
> pipeline, dashboard, and AI agent — but more importantly, the
> mistakes I made along the way. Because if your team is going to ship
> AI features this year, the failure modes you'll hit are not the
> obvious ones.

---

### Slide 2 — What I built

**Visual:** the system architecture diagram
```
   raw POS CSV ─┐
                ├── pipeline ──── Supabase ──── FastAPI ──── V0 dashboard
   raw ecom JSON ┘     (clean)    (database)   (API + agent) (UI)
                       ▲
                  AI product
                  resolution
                  (Claude/Gemini)
```
List the major components with one line each.

**Talk track:**
> Quick context. The prototype simulates two months of POS and ecommerce
> sales for a Walmart Supercenter — a few thousand transactions, dirty
> data with mixed timestamp formats and abbreviated product names. A
> Python pipeline cleans it, a small AI step resolves the abbreviated
> SKUs that rule-based matching can't handle, and the cleaned data
> lands in a Supabase Postgres table. On top of that there's a FastAPI
> backend exposing 14 endpoints, and an LLM-powered agent that can
> answer natural-language questions about the data. A V0-generated
> dashboard ties it together.
>
> Total time to build: about a week. Total time without AI assistance:
> realistically 4-6 weeks.

---

### Slide 3 — The headline lesson

**Visual:** large text, single sentence:
> **AI doesn't eliminate rigor. It moves rigor into the prompt, the
> model config, and the contract with the vendor.**

**Talk track:**
> The thing I want you to take away from today is this: vibe-coding
> doesn't make you faster *because* you skip rigor — it makes you
> faster *if* you know where to put the rigor. Skip it in the wrong
> places and you ship plausible-looking nonsense.
>
> The rest of this talk is concrete examples of where the rigor has
> to live, and what happens when you skip it.

---

## ACT 2 — THE METHODOLOGY THAT WORKED (6 slides)

### Slide 4 — Plan before you code

**Visual:** two-column comparison.

| Old way | What worked here |
|---|---|
| Open IDE, start typing | Open ChatGPT/Claude chat, write a 1-page plan |
| Discover scope as you go | Discover scope before code is written |
| Ask Claude Code to build X | Ask Claude Code to build *this specific plan* |

**Talk track:**
> The first counterintuitive lesson: don't open Claude Code as your
> first move. Open a chat interface — Claude or ChatGPT — and write a
> comprehensive plan first. Schema. Endpoints. Cleaning stages. What
> the data looks like. What edge cases matter.
>
> Then hand that plan to Claude Code as a constraint, not a wish.
> Claude Code with a tight plan ships in hours. Claude Code with a
> vague "build me a sales dashboard" prompt produces five days of
> rewrites. The plan is the spec; the IDE is just the executor.

---

### Slide 5 — Tell the model to be harsh

**Visual:** quote-style block:
> *"Be harsh on this idea, and tell me where it breaks."*

**Talk track:**
> When you have your plan, give it back to a chat-based LLM and ask it
> to attack it. Specifically tell it to be harsh, find what's missing,
> identify what could go wrong. LLMs are sycophantic by default — they
> will agree with you. You have to explicitly invite criticism.
>
> In this project, that pattern caught at least three issues before I
> wrote a line of code: an ambiguous schema decision, a missing edge
> case in the data generator, and a chart in the original design that
> the database literally couldn't support. All three would have been
> half a day of rework each.

---

### Slide 6 — Modern tooling collapses days into minutes

**Visual:** stack diagram showing the tooling layers and what each
saved.

| Layer | Tool | What it replaces |
|---|---|---|
| Database | Supabase | Manual Postgres setup, hosting, auth, REST API |
| Backend | FastAPI | Hand-rolled routes, manual OpenAPI, manual CORS |
| AI | Anthropic / Gemini SDK | Custom NLP for product matching |
| Frontend | V0 | Manual React + Tailwind boilerplate |

**Talk track:**
> Three of the four layers used to be week-long efforts; now they're
> minutes. Supabase: I had a Postgres database with a REST layer in
> five minutes. FastAPI: 14 endpoints with auto-generated docs in an
> afternoon. V0: a designer is producing real React code from prompts.
>
> What this means for product work: ideas that used to require an
> engineer + a sprint can now be a prototype by Friday. The
> bottleneck shifted from "do we have the time" to "do we have the
> right idea."

---

### Slide 7 — One tool surface, two consumers

**Visual:** diagram:
```
        ┌─ /kpi GET endpoint ─────► Dashboard
Python ─┤
tools   └─ Gemini tool call ────► AI Agent
```

**Talk track:**
> A small architectural decision that paid off enormously. Instead of
> writing analytical queries twice — once for the dashboard endpoints
> and once for the agent — I wrote them once as Python functions, and
> wrapped them two ways. FastAPI converts each function to a REST
> endpoint. The Gemini SDK exposes each function as a tool the agent
> can call.
>
> One source of truth, two consumers. When I add a chart, I add one
> Python function and both the dashboard and the agent get the
> capability. This is the pattern for any product where you want
> humans and AI agents to read from the same data spine.

---

### Slide 8 — Hybrid AI: deterministic first, AI for the last mile

**Visual:** two boxes side-by-side, with the cleaning stages.
```
DETERMINISTIC                        │   AI
─────────────────────────────────────┼────────────────────────
Parse timestamps                     │   Resolve abbreviated
Drop duplicates                      │   product strings
Normalize prices                     │   ("GV WHL MLK 1GL"
Route nulls to fulfillment center    │    → product_id)
─────────────────────────────────────┼────────────────────────
~97% of rows handled                 │   ~3% of rows handled
$0 per call                          │   ~$0.001 per call
Fast, deterministic, auditable       │   Slow, probabilistic
```

**Talk track:**
> The principle: AI is expensive, slow, and has tail risk. Use it
> *surgically*, only on the cases where deterministic logic genuinely
> can't handle the problem.
>
> In this prototype, 97% of the rows go through pure pandas
> transformations — fast, free, reproducible. The AI step kicks in
> only on the abbreviated product strings that a manual POS register
> would generate, which rule-based matching can't handle without an
> ever-growing hand-maintained lookup table.
>
> This is "AI on rails." It also happens to be how every production
> AI feature I respect is actually built — narrow, scoped, with a
> deterministic fallback path. Not "wrap AI around the whole flow."

---

### Slide 9 — Data contracts unblock parallel work

**Visual:** timeline diagram.
```
Day 1        Day 2-4               Day 5
─────        ─────────              ─────
Agree on     [ Vignesh: build      [ Integration:
endpoint     [   API + agent       [   wire dashboard
shapes       [                     [   to real API
             [ Designer: V0        [
             [   components        [
             [   with mock data    [
```

**Talk track:**
> The other thing that compressed the timeline: I worked in parallel
> with my design partner. But that only worked because we agreed on
> the data shapes — what JSON each endpoint returns — before either
> of us started. She designed against mock data that matched the
> exact API response shape; I built against the same contract.
>
> When we met to integrate, it was 30 minutes of mechanical work, not
> two days of "your component expects fields the API doesn't return."
> Define the data contract first, then build in parallel. Same
> principle as API-first development, applied to design.

---

## ACT 3 — THE PITFALLS (3 slides — the heart of the talk)

### Slide 10 — The new failure mode

**Visual:** large text, dramatic spacing:
> **The system returned a 200 OK.**
>
> **The numbers were wrong.**
>
> **Nothing told me out loud.**

**Talk track:**
> This is the failure mode you have to learn to see. In old-style
> development, when something went wrong, you got a stack trace, a
> red console line, a 500 error. Loud failures. Easy to fix.
>
> AI systems and the modern tools they sit on top of fail *quietly*.
> The model returns plausible text that's wrong. The database returns
> 1000 rows when you wanted 1741. The API returns 200 OK with stale
> data. None of it shouts at you. You discover it when you delete the
> table and notice the row count was different than you thought.
>
> The job of building reliably with AI is the job of forcing those
> silent failures to be loud.

---

### Slide 11 — Concrete pitfalls

**Visual:** four quick vignettes (one per quadrant of the slide):

| Pitfall | Symptom | Cause |
|---|---|---|
| **Underspecified prompt** | AI returned `UNKNOWN` for `SPRITE 2L` (a product that's literally in the catalog) | "Best matches" and "confident" are gestures, not specs |
| **Thinking budget trap** | Gemini returned the single character `'0'` instead of a product_id | `max_output_tokens=50` was eaten by internal reasoning before the answer |
| **Silent 1000-row truncation** | Dashboard showed $8K revenue. Real number was $14K. | PostgREST caps at 1000 rows by default; query worked, returned rows, silently clipped |
| **"Free tier" means three different things** | API key worked. Then 429s. Then quota=0. Then RLS denied writes. | Free tier ≠ free tier across vendors and models |

**Talk track:**
> Four representative pitfalls from this project. The full list is
> eight. Each one is something where I had a plausible mental model,
> the system did something different, and nothing alerted me until
> downstream numbers looked wrong.
>
> Notice the pattern: none of these are AI failures. They're all
> failures of *defaults* — the prompt's defaults, the model's
> defaults, the database's defaults, the vendor's billing defaults.
> Vibe-coding is fast partly because you accept defaults; that
> speed comes with the bill that those defaults will eventually
> disagree with you, quietly, in production.

---

### Slide 12 — Track pitfalls as a discipline

**Visual:** screenshot or excerpt of `PITFALLS.md`.

**Talk track:**
> One concrete practice I'd recommend if your team starts shipping
> AI features: keep a running pitfalls document. Every time you hit
> one of those silent-failure moments, write it down. Symptom, cause,
> what you assumed, what was actually true, how you fixed it.
>
> In this project I kept that as a markdown file in the repo. It
> serves three purposes: it's a debugging knowledge base for future
> me, it's onboarding material for whoever joins next, and — most
> importantly for a presentation like this — it's an honest signal
> to stakeholders that "the demo works because we caught these eight
> things, not because nothing went wrong."
>
> AI features without a pitfalls document are a rumor. AI features
> with one are a system.

---

## ACT 4 — CLOSE (3 slides)

### Slide 13 — Demo

**Visual:** screenshot of the dashboard with a sample agent question:
> "Which category missed forecast the most last month?"

**Talk track:**
> Let me show you the system live. I'll walk through:
>
> 1. The pipeline cleaning a deliberately-dirty raw input
> 2. The AI step resolving an abbreviated SKU correctly
> 3. The dashboard rendering the same data
> 4. The agent answering a natural-language question by calling the
>    same tools the dashboard uses
> 5. (If time) the agent recognizing an out-of-scope question and
>    declining to make up a number
>
> Total: about 4 minutes.

(You'll want to rehearse this so it lands clean. Don't ad-lib.)

---

### Slide 14 — PM takeaways

**Visual:** bulleted list, large type:
> 1. **Prompts are specs.** Every place you write "the right thing" is a
>    place the model decides for you.
> 2. **Plan before you code.** Two hours of planning saves five days of
>    rebuilding.
> 3. **Tell the model to be harsh.** It will agree with you by default;
>    you have to invite the criticism.
> 4. **Define data contracts before parallel work.** Same logic as API
>    contracts, applied across humans + AI.
> 5. **Make silent failures loud.** Validate against ground truth, not
>    plausibility. Track pitfalls as a discipline.
> 6. **Hybrid AI — deterministic first, AI for the last mile.** This is
>    how production-grade AI features actually work.

**Talk track:**
> If you take six things back to your team from today, take these.
> They generalize beyond this project — every AI product you ship will
> hit some version of all six.

---

### Slide 15 — Thank you / Q&A

**Visual:**
> Questions?
>
> Repo: [github.com/vigneshmodigunta/walmart-data-project](#)
> Pitfalls doc: in the repo as `PITFALLS.md`

**Talk track:**
> Happy to take questions on any of this — the architecture, the
> specific pitfalls, the methodology, or how this would apply to
> something the Data Ventures team is actually working on.

---

## Things I'd actively avoid in this deck

- **Don't lead with "AI is amazing."** Every PM in that room has heard
  that pitch. Lead with honesty: "here's what was hard."
- **Don't skip the demo.** This entire talk lands stronger if there's
  a working live demo, even a 2-minute one. PMs trust working things
  over described things.
- **Don't use the word "agentic."** It's a tell that you're using
  marketing language instead of technical language. "Agent" is fine
  because it's accurate; "agentic workflows" is buzzwordy.
- **Don't claim AI will replace anything.** That's an irrelevant
  argument and gets people defensive. Frame it as "AI accelerates
  building, the rigor moves to a different place."

## Things to rehearse

- The **demo flow** specifically. Have a runbook with the exact
  questions you'll ask the agent and the order of clicks. Live demos
  fail when ad-libbed.
- The **SPRITE 2L story** — that's the most teachable concrete pitfall
  and you'll come back to it. Get the framing tight.
- The transition from slide 9 (parallel work) to slide 10 (silent
  failures). That's the inflection point of the talk and needs a
  clean handoff.
