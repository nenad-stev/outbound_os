# Outbound OS — Spec

Internal SaaS for an outreach agency. Centralizes clients, ICPs, audience imports,
deduplication, enrichment, AI scoring, and pushing leads into HeyReach campaigns —
with a **prospect ledger** that tracks every message, connection, and reply so the
team can run many clients/campaigns without double-contacting or bad audiences.

## Stack
- **Next.js (App Router) + Tailwind** — UI + API routes
- **Supabase / Postgres** — DB + Auth (email/password, roles: admin / operator / viewer)
- **Claude API (Sonnet 4.6)** — ICP scoring + personalization
- **Apollo** — lead search (param builder + saved-search URL) & enrichment
- **Firecrawl** — website scraping (qualify cascade)
- **Bright Data** — person enrichment
- **HeyReach** — LinkedIn outreach (`api.heyreach.io/api/public`, webhooks, lead tags)
- **Discord + n8n** — notifications / automation

## Core flow
1. **Import** — CSV upload or Apollo search. At import the user picks **client +
   sender profile + campaign** (and ICP profile).
2. **Qualify cascade** (cost control, cheapest signal first):
   Firecrawl homepage → LinkedIn company About → person LinkedIn About →
   else `not_able_to_qualify`. Only qualified leads continue.
3. **Enrich** qualified leads → **AI score** (hybrid 100-pt rubric).
4. **Review queue** — full scored list, sorted; operator approves/rejects.
5. **Push** approved → HeyReach list/campaign for the chosen profile.
6. **Ledger** tracks messages, connection state, replies (via HeyReach webhooks).
7. **Rotation & follow-ups** — eligible leads collected into pools + Discord notice;
   operator confirms.

## Key rules (see DB schema `supabase/migrations/0001_initial_schema.sql`)
- **Match key:** LinkedIn URL primary, email fallback (`people` unique indexes).
- **Dedup:** per-client — one live `lead_assignment` per (person, client).
- **Rotation:** a lead can move to the next sender profile only if the connection
  was **not accepted** and was **withdrawn ≥ 30 days** after the request. Cascades
  through profiles by `sender_profiles.rotation_order`. Hybrid: collected in
  `rotation_pool`, operator confirms.
- **Company overlap:** no simultaneous active contact of two people at the same
  company by different profiles (`lead_assignment_active_per_company`).
- **Follow-ups:** non-responders (accepted, no reply to steps 1–2) become eligible
  after `campaigns.followup_delay_days` (~60). Collected in `followup_pool`, hybrid.
- **Personalization:** per-campaign slider — light / medium / heavy.
- **Message dedup:** every send recorded in `message_log`; never the same message
  twice, never from two profiles at one company.

## Reuse from go-to-market-orchestrator
- Scoring rubric → `lead-prioritizer` (ICP 40 / signal 35 / engagement 25)
- Personalization → `personalization-writer`, `hook-writer`
- Enrichment fields → `lead-enrichment`; signals → `signal-scraper`
- Discord/n8n notifications → orchestrator `discord.py` / `n8n.py`

## Build order
"All at once" — full Phase 1 including lifecycle before first use.
Later phases: Apollo in-app search polish, Content OS (per-client content plans
+ Claude Design), reporting dashboards (outreach + LinkedIn content per profile).

## Local dev
Requires **Docker Desktop** for `supabase start` (local Postgres/Auth/Studio).
Copy `.env.local.example` → `.env.local` and fill keys.
