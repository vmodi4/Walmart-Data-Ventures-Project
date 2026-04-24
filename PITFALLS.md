# Pitfalls — what vibe-coding this prototype actually looked like

A real log of the mistakes made while building this pipeline with AI
assistance. Each one is a small thing on its own; together they make the
case that AI-accelerated development isn't "free" — it shifts where the
rigor has to go.

---

## 1. The underspecified prompt (`SPRITE 2L` silently dropped)

**Symptom.** On the first successful pipeline run, 6 of 8 dirty product
strings resolved correctly. Two failed. One of the failures was `SPRITE 2L`
— a string that is verbatim identical to a product_name in the catalog
(`"Sprite 2L"`). The model returned `UNKNOWN` and the row was dropped.

**What the prompt said.**
> "return the product_id that best matches, or UNKNOWN if no confident match exists"

**Why it failed.** "Best matches" and "confident" are prompt-shaped but not
specification-shaped. I gestured at what I wanted — match somehow, use
judgment — without telling the model *how* to match (name vs UPC vs
substring), what "confident" means (threshold? criteria?), or showing an
example of the expected behavior. A reasonable, temperature-0 model facing
ambiguous instructions can absolutely choose "abstain" as the safe answer.

**What would fix it.** Few-shot examples in the prompt, an explicit rule
that says "match by product_name if the raw string appears to be an
abbreviation or contains the product name," and a clearer definition of
when to return UNKNOWN (e.g., "only if the raw string could plausibly refer
to more than one catalog entry").

**Takeaway.** A prompt isn't a feature spec until it *is* one. Every place
you write "the right thing" or "best match" is a place the model will make
a decision you didn't make. AI features fail the same way product features
fail: underspecified requirements.

---

## 2. The thinking-budget trap (Gemini returned `'0'` instead of the product_id)

**Symptom.** After swapping from the Anthropic SDK to `google-genai`, the
first test call returned the single character `'0'` no matter what I asked.
Prompt was fine, API key was fine, no errors, no warnings.

**Root cause.** I set `max_output_tokens=50` because that was a reasonable
number for a short product_id. But `gemini-2.5-flash` has **thinking mode
enabled by default** — the model uses output tokens for internal reasoning
before producing the visible answer. With the budget set to 50, thinking
consumed the whole allowance and the visible output got truncated to a
single token.

**The fix.**
```python
config = types.GenerateContentConfig(
    temperature=0,
    max_output_tokens=50,
    thinking_config=types.ThinkingConfig(thinking_budget=0),
)
```
One extra line. Ten minutes of staring at the wrong thing before finding it.

**Takeaway.** Modern frontier models have runtime behaviors (thinking
budgets, tool-use loops, content-safety filters) that aren't visible in the
call signature. Treating the API as a pure "prompt in, text out" black box
is how you spend an afternoon debugging a silent truncation. If the output
surprises you, read the model's docs before you touch the prompt.

---

## 3. Assumed one Google API key = one Google API key (quota = 0)

**Symptom.** First full run with Gemini hit 429 RESOURCE_EXHAUSTED on every
call. Retry didn't help. The error message said:
> "Quota exceeded ... **limit: 0**, model: gemini-2.0-flash"

**What I assumed.** I picked `gemini-2.0-flash` because it's Google's
commonly documented free-tier Flash model. I assumed "have API key → have
free tier quota" was a binary thing.

**What actually happened.** The specific model's free-tier quota policy had
changed; the key I had was provisioned against a project that didn't have
any free allocation for `gemini-2.0-flash`. Switching to `gemini-2.5-flash`
— the current-generation model — had a working free tier immediately.

**Takeaway.** "Free tier" is a per-model, per-project, per-quarter policy
decision at the vendor, not a property of the key. Anything you build on
top of a free tier is built on sand; for a prototype that's fine, but in
production you want billing enabled and a budget alarm, not a "well it
should be free" mental model.

---

## 4. Pinning a version to a list I didn't verify

**Symptom.** `supabase==2.9.1` (pinned in the original `requirements.txt`
because that version number "sounded reasonable") rejected the project's
`sb_publishable_...` API key as malformed. The client validated keys
against an older JWT-only format and raised "Invalid API key" before ever
making a network call.

**What I did.** Pinned five dependency versions at the start of the project
based on what I thought were current stable releases. Didn't verify any of
them against the versions of Supabase I'd actually be talking to.

**What happened later.** Same story again with `google-genai==1.0.0` — the
version I pinned didn't yet support the `thinking_config` keyword, so the
fix in pitfall #2 raised a pydantic validation error until I upgraded the
SDK.

**Takeaway.** "Pinned versions" only provides reproducibility if the pin
points at something that actually works with the rest of your stack. On a
real project this is what a CI smoke test would catch on day one; on a
prototype it's the kind of paper cut that costs twenty minutes every time
a dependency moves under you.

---

## 5. Real secrets in the wrong file

**Symptom.** Nothing broke — that's the scary part. I pasted my real
Supabase URL, Supabase key, and Gemini API key into `.env.example` instead
of `.env`. `.env.example` is the *template* file that gets checked in;
`.env` is the gitignored file the scripts actually read.

**What would have happened.** The scripts couldn't find the keys
(`load_dotenv()` reads `.env`, not `.env.example`), so the pipeline failed
with a `KeyError` on first run. Bad — but recoverable. **What could have
happened:** a `git add .` anywhere in the workflow would have committed
live credentials to a repo that might later go public.

**Takeaway.** Secrets have two required properties — available to the app,
invisible to the world — and conflating the template file and the real
file silently breaks both. Any project that has a `.env.example` needs
both (a) `.env` in `.gitignore` and (b) at least one mental beat when
putting keys somewhere asking "is this file checked in?"

---

## 6. The silent 1000-row cap (PostgREST defaults lied to me)

**Symptom.** First run of the analytical tools reported 1,000 transactions
in the database — which seemed plausible but felt a little round. The
dashboard tool said total revenue was $8,040 and every forecast category
missed by 97-98%. The agent would have happily parroted those numbers to
anyone who asked.

**Root cause.** Supabase's PostgREST layer caps each response at 1,000 rows
by default. A `select *` on a 1,741-row table returns 1,000 rows with a
`200 OK` — no error, no warning, just silently clipped. The missing 741
rows happened to be entirely the ecommerce channel, which is what made the
forecast-vs-actual numbers look like a catastrophe (100% of ecommerce
revenue was invisible to the aggregation).

**The fix.** Paginate with `.range(start, end)` in a loop until a short
page indicates end of table. Or use `Prefer: count=exact` and respect the
`Content-Range` header. Or raise the `max-rows` setting server-side.

**Takeaway.** "Reasonable-looking numbers" is a weaker safety signal than
it feels like. When a tool output is slightly off but self-consistent, the
model downstream will rationalize it — it has no way to know that 741 rows
were missing. The only thing that caught it here was running a DELETE and
seeing the actual row count in the response. Anything that aggregates data
needs either a row-count sanity check against an independent source of
truth, or a fetch path that can't silently truncate. This failure mode
becomes catastrophic in agent systems: the AI confidently summarizes
incomplete data as if it were complete.

---

## 7. RLS by default, key format by default — the Supabase setup surprise

**Symptom.** Running `supabase_setup.sql` in a fresh Supabase project
triggered a warning about Row Level Security. Even after the DDL
succeeded, attempting to insert with the publishable key failed silently
on the first run (nothing inserted, no error, empty table).

**Why.** New Supabase projects enable RLS on public-schema tables by
default. With RLS on and no policies defined, the anon/publishable key is
denied all access. Disabling RLS on these specific tables (fine for a
prototype with simulated data) or using the service_role key (standard for
backend scripts) both work — but "which of those is correct" depends on
context nobody told me.

**Takeaway.** Platform defaults encode the platform's opinions about your
likely use case. Supabase's defaults assume a browser app talking to a
protected backend; this prototype is a backend script talking to a dev
database. Reading the first-run warnings and matching them to your actual
architecture is five minutes that saves an hour of silent failure.

---

## What these have in common

None of the bugs above were failures of the AI tools, or of my skill with
pandas or supabase or Gemini. They're all cases where I made a plausible
assumption, the environment happened to not match the assumption, and
nothing told me out loud that something was off.

That's the actual challenge of vibe-coded AI pipelines: the model will
usually give you something that looks right, so every mismatch between
"what I meant" and "what the system thought I meant" has to be surfaced by
you, not by a loud failure. Building AI features is not fundamentally
different from building non-AI features — it just concentrates more of the
rigor into the prompt, the model config, and the contract between your
code and a vendor's evolving policies.
