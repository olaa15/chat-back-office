# CLAUDE.md — Conversational Back-Office Agent

Project memory for Claude Code. Read `BUILD.md` for the full roadmap and `db/schema.sql` for the data layer.

## What we're building
A chat-driven business back-office: a user messages a bot in plain language ("Generate an invoice for ABC Company for £250,000 consulting services") and the system parses it, generates a branded PDF invoice, stores it, files the record, and replies in chat. A web dashboard shows the data; a scheduled job sends weekly summaries.

## Architecture
Telegram (later WhatsApp) → bot webhook → Claude API tool-use extracts structured fields → code validates → code generates PDF / updates records → Supabase stores → reply in chat. A Trigger.dev cron sends weekly summaries. A Next.js dashboard reads the same Supabase data. Full flow and diagram in `BUILD.md`.

## Tech stack
- Node.js + TypeScript (backend and bot)
- Telegram Bot API first; WhatsApp Cloud API later (Phase 8)
- Anthropic Claude API with tool-use for intent + field extraction
- Supabase (Postgres + Storage + Auth) — schema in `db/schema.sql`
- Puppeteer (HTML template → PDF)
- Next.js on Vercel (dashboard)
- Trigger.dev (scheduled weekly summaries)

## Critical invariants — do not violate these

**IMPORTANT: The LLM extracts data; it never does arithmetic or generates the invoice.** Claude tool-use returns structured fields only. All totals, tax, and invoice generation are done by deterministic code. Never let a model-produced number become a financial figure without code computing it.

**IMPORTANT: Never act on a financial request without explicit user confirmation.** Echo the parsed fields back in chat and wait for a yes before creating an invoice, recording a payment, or changing any record. If a required field is missing or ambiguous, ask — do not guess. Never invent an amount.

**YOU MUST keep the Supabase service-role key server-side only.** The bot backend uses the service role, which bypasses RLS, so the bot MUST scope every query by `business_id` in code. Never ship the service key to the browser or any client bundle. The dashboard uses the anon/authenticated key and relies on RLS.

**YOU MUST enforce tenant isolation on every query.** Every read or write of business data is scoped to a single `business_id`. One business must never see another's data. Resolve the business from `telegram_links` for bot requests, and from the authenticated user for dashboard requests.

- Make invoice creation idempotent — a retried or duplicated message must not create two invoices. Use a message/request id.
- Write an `audit_log` row for every create/modify of financial data (actor, action, entity, metadata).
- Generate invoice numbers via the `next_invoice_number(business_id)` SQL function — never compute max+1 in app code (race condition).

## Conventions
- All secrets via environment variables (`.env`, gitignored). Never hardcode tokens or keys.
- Strict TypeScript; validate all external input (Telegram payloads, extracted fields) before use — Zod or equivalent.
- Suggested layout: `src/bot/`, `src/llm/` (tool defs + extraction), `src/invoices/` (PDF + numbering), `src/db/` (Supabase client + queries), `src/jobs/` (Trigger.dev), `db/schema.sql`, `dashboard/` (Next.js).
- Commit after each working phase with a clear message. Keep each phase independently runnable.
- Add a small labelled test set of real phrasings for the extraction step; re-run it after any prompt change to catch regressions.

## Phase plan — definition of done
Work one phase at a time. Plan before coding (use plan mode). Do not start a phase until the previous one runs.

0. **Echo bot** — Telegram webhook receives a message and replies. Done: bot echoes.
1. **Extraction** — Claude tool-use turns a message into structured invoice fields; asks for missing fields; echoes for confirmation. Done: varied phrasings parse correctly; missing amount triggers a question, not a guess.
2. **PDF** — confirmed fields → HTML template → Puppeteer PDF → sent in chat. Done: a clean, correctly-formatted £ invoice arrives in seconds.
3. **Persistence** — run `db/schema.sql` in Supabase; store business profile, invoices, and PDF in Storage. Done: invoices survive restart; history is queryable.
4. **More intents** — `record_payment`, `list_invoices`, `get_balance`. Done: payment and balance queries read real data.
5. **Dashboard** — Next.js + Supabase Auth showing invoices/payments behind login. Done: web shows everything created via chat.
6. **Onboarding** — 5-stage setup; link Telegram to a business via one-time code; use the logo in the PDF. Done: a new user goes sign-up → working branded bot with no manual setup.
7. **Weekly summary** — Trigger.dev cron summarises each business and sends via the bot, with logging and failure alerting. Done: summary arrives weekly per business; failures alert.
8. **Stretch** — WhatsApp channel, payment links (Paystack/Stripe), receipt capture, multi-currency/VAT.

## Commands
<!-- Fill in as the project takes shape -->
- Install: `npm install`
- Dev (bot): `npm run dev`
- Tunnel for Telegram webhook (dev): `ngrok http <port>`
- Run extraction tests: `npm test`

## State
<!-- BEGIN STATE -->
Current phase: 8 (stretch — optional)
Blockers: none
Done: WhatsApp channel, Stripe payment links, receipt/expense capture, multi-currency default + VAT/tax handling
Next: nothing required — Phase 8 stretch list is complete; pick further enhancements at will
<!-- END STATE -->