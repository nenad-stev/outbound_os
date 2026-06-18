-- Outbound OS — initial schema
-- Agency outreach SaaS: clients, ICPs, audiences, dedup, enrichment, AI scoring,
-- and the prospect ledger (campaigns, messages, connection state, rotation, follow-ups).
--
-- Conventions:
--   * UUID primary keys (gen_random_uuid()).
--   * timestamptz everywhere, default now().
--   * Enrichment / flexible config stored as jsonb.
--   * RLS is added in a later migration; for now the app uses the service role.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role          as enum ('admin', 'operator', 'viewer');
create type campaign_type       as enum ('initial', 'follow_up', 'ad_hoc');
create type personalization_level as enum ('light', 'medium', 'heavy');
create type campaign_status     as enum ('draft', 'active', 'paused', 'archived');
create type sequence_channel    as enum ('connection_request', 'message', 'inmail');
create type qualify_status      as enum ('pending', 'qualified', 'disqualified', 'not_able_to_qualify');
create type qualify_source      as enum ('website', 'linkedin_company', 'linkedin_person', 'none');
create type priority_tier       as enum ('tier_1', 'tier_2', 'tier_3', 'tier_4');
create type assignment_status   as enum (
  'pending_review',   -- scored, awaiting operator approval
  'approved',         -- approved, queued to push
  'pushed',           -- sent to HeyReach
  'active',           -- live in a campaign
  'replied',          -- lead responded
  'completed',        -- sequence finished, no reply
  'rotated_out',      -- moved off this profile (eligible for next)
  'rejected',         -- operator rejected
  'disqualified'
);
create type connection_state    as enum ('not_sent', 'requested', 'accepted', 'withdrawn', 'declined');
create type message_status      as enum ('queued', 'sent', 'delivered', 'replied', 'failed');
create type pool_status         as enum ('pending', 'approved', 'dismissed');

-- ---------------------------------------------------------------------------
-- App users (linked to Supabase auth.users)
-- ---------------------------------------------------------------------------
create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'operator',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  website     text,
  notes       text,
  is_active   boolean not null default true,
  created_by  uuid references app_users(id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ICP profiles (one or more per client)
--   weight_overrides: { "icp_fit": 40, "signal": 35, "engagement": 25 }
--   must_have / must_not: arrays of rule objects evaluated during scoring
-- ---------------------------------------------------------------------------
create table icp_profiles (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  name              text not null,
  target_description text,            -- "what good firms look like" (used by qualify cascade)
  anti_target       text,            -- firms we explicitly do NOT want
  target_roles      text[] default '{}',
  good_signals      text[] default '{}',
  bad_signals       text[] default '{}',
  weight_overrides  jsonb not null default '{"icp_fit":40,"signal":35,"engagement":25}',
  must_have         jsonb not null default '[]',
  must_not          jsonb not null default '[]',
  is_default        boolean not null default true,
  created_at        timestamptz not null default now()
);
create index on icp_profiles (client_id);

-- ---------------------------------------------------------------------------
-- Sender profiles (LinkedIn sender accounts; a client may have many)
-- ---------------------------------------------------------------------------
create table sender_profiles (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(id) on delete cascade,
  name                 text not null,           -- person operating the LinkedIn account
  linkedin_url         text,
  heyreach_account_id  text,                    -- maps to HeyReach LinkedIn account
  rotation_order       int not null default 0,  -- order profiles take a lead in rotation
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);
create index on sender_profiles (client_id);

-- ---------------------------------------------------------------------------
-- Campaigns + sequence steps
--   parent_campaign_id chains follow-ups to their source campaign.
--   followup_delay_days: how long after non-reply a lead becomes follow-up eligible.
-- ---------------------------------------------------------------------------
create table campaigns (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references clients(id) on delete cascade,
  name                  text not null,
  type                  campaign_type not null default 'initial',
  personalization_level personalization_level not null default 'light',
  status                campaign_status not null default 'draft',
  heyreach_campaign_id  text,
  parent_campaign_id    uuid references campaigns(id) on delete set null,
  followup_delay_days   int default 60,
  created_by            uuid references app_users(id),
  created_at            timestamptz not null default now()
);
create index on campaigns (client_id);

create table sequence_steps (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  step_order    int not null,
  channel       sequence_channel not null default 'message',
  template_text text not null,                 -- supports {first_name}, {company}, etc.
  delay_days    int not null default 0,        -- delay after previous step
  created_at    timestamptz not null default now(),
  unique (campaign_id, step_order)
);

-- ---------------------------------------------------------------------------
-- Companies (deduped on domain / linkedin company url)
-- ---------------------------------------------------------------------------
create table companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text,
  domain              text,
  linkedin_company_url text,
  industry            text,
  employee_count      int,
  enrichment          jsonb not null default '{}',  -- firmographics, tech, signals
  created_at          timestamptz not null default now()
);
create unique index companies_domain_key on companies (lower(domain)) where domain is not null;
create index on companies (linkedin_company_url);

-- ---------------------------------------------------------------------------
-- People (leads). Dedup key = LinkedIn URL (email fallback).
-- ---------------------------------------------------------------------------
create table people (
  id           uuid primary key default gen_random_uuid(),
  linkedin_url text,
  email        text,
  first_name   text,
  last_name    text,
  full_name    text,
  title        text,
  company_id   uuid references companies(id) on delete set null,
  enrichment   jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
-- Global identity dedup: one person row per LinkedIn URL (email as secondary).
create unique index people_linkedin_key on people (lower(linkedin_url)) where linkedin_url is not null;
create unique index people_email_key     on people (lower(email))        where email is not null;

-- ---------------------------------------------------------------------------
-- Audiences (an import batch) + raw members with qualify result
-- ---------------------------------------------------------------------------
create table audiences (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  campaign_id       uuid references campaigns(id) on delete set null,
  sender_profile_id uuid references sender_profiles(id) on delete set null,
  icp_profile_id    uuid references icp_profiles(id) on delete set null,
  name              text not null,
  source            text not null default 'csv',  -- 'csv' | 'apollo_search' | 'apollo_saved'
  source_meta       jsonb not null default '{}',  -- apollo params / saved-search url / filename
  row_count         int default 0,
  imported_by       uuid references app_users(id),
  created_at        timestamptz not null default now()
);
create index on audiences (client_id);

create table audience_members (
  id              uuid primary key default gen_random_uuid(),
  audience_id     uuid not null references audiences(id) on delete cascade,
  person_id       uuid references people(id) on delete set null,
  raw             jsonb not null default '{}',          -- original imported row
  qualify_status  qualify_status not null default 'pending',
  qualify_source  qualify_source,
  qualify_reason  text,
  created_at      timestamptz not null default now()
);
create index on audience_members (audience_id);
create index on audience_members (person_id);

-- ---------------------------------------------------------------------------
-- Lead scores (AI scoring output, per person per ICP profile)
-- ---------------------------------------------------------------------------
create table lead_scores (
  id                       uuid primary key default gen_random_uuid(),
  person_id                uuid not null references people(id) on delete cascade,
  icp_profile_id           uuid references icp_profiles(id) on delete set null,
  audience_member_id       uuid references audience_members(id) on delete cascade,
  fit_score                int,             -- 0-100
  priority                 priority_tier,
  icp_fit_score            int,
  signal_strength_score    int,
  engagement_score         int,
  reasoning                text,
  personalization_sentence text,
  scored_at                timestamptz not null default now()
);
create index on lead_scores (person_id);
create index on lead_scores (audience_member_id);

-- ---------------------------------------------------------------------------
-- LEDGER CORE: lead_assignments
--   One row per person assigned to a (client, sender_profile, campaign).
--   Per-client dedup is enforced on active assignments via a partial unique index.
--   Rotation creates a NEW assignment to the next profile; old rows are kept
--   as history (status = rotated_out).
-- ---------------------------------------------------------------------------
create table lead_assignments (
  id                uuid primary key default gen_random_uuid(),
  person_id         uuid not null references people(id) on delete cascade,
  company_id        uuid references companies(id) on delete set null,
  client_id         uuid not null references clients(id) on delete cascade,
  sender_profile_id uuid references sender_profiles(id) on delete set null,
  campaign_id       uuid references campaigns(id) on delete set null,
  audience_id       uuid references audiences(id) on delete set null,
  status            assignment_status not null default 'pending_review',
  rotation_round    int not null default 1,   -- 1 = first profile, 2 = second, ...
  assigned_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on lead_assignments (client_id);
create index on lead_assignments (campaign_id);
create index on lead_assignments (person_id);
create index on lead_assignments (company_id);

-- Per-CLIENT dedup: a person can only have one "live" assignment per client.
-- Live = anything not terminal (rejected/disqualified/rotated_out/completed).
create unique index lead_assignment_active_per_client
  on lead_assignments (person_id, client_id)
  where status in ('pending_review','approved','pushed','active','replied');

-- Company "no simultaneous overlap": at most one active assignment per
-- (company, client) at a time. App logic checks this before activating; the
-- index documents/enforces the live-overlap rule.
create unique index lead_assignment_active_per_company
  on lead_assignments (company_id, client_id)
  where status in ('pushed','active');

-- ---------------------------------------------------------------------------
-- Connection state (per assignment) — fed by HeyReach webhooks + 30-day check
-- ---------------------------------------------------------------------------
create table connection_status (
  id                  uuid primary key default gen_random_uuid(),
  lead_assignment_id  uuid not null references lead_assignments(id) on delete cascade,
  state               connection_state not null default 'not_sent',
  requested_at        timestamptz,
  accepted_at         timestamptz,
  withdrawn_at        timestamptz,
  updated_at          timestamptz not null default now(),
  unique (lead_assignment_id)
);

-- ---------------------------------------------------------------------------
-- Message log — every message a lead received (prevents duplicate sends)
-- ---------------------------------------------------------------------------
create table message_log (
  id                  uuid primary key default gen_random_uuid(),
  lead_assignment_id  uuid not null references lead_assignments(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete set null,
  sequence_step_id    uuid references sequence_steps(id) on delete set null,
  sender_profile_id   uuid references sender_profiles(id) on delete set null,
  channel             sequence_channel not null default 'message',
  rendered_text       text,                       -- personalized message actually sent
  status              message_status not null default 'queued',
  sent_at             timestamptz,
  replied_at          timestamptz,
  heyreach_message_id text,
  created_at          timestamptz not null default now()
);
create index on message_log (lead_assignment_id);
create index on message_log (campaign_id);

-- ---------------------------------------------------------------------------
-- Rotation pool — leads eligible to move to the next sender profile
-- (no accept + withdrawn >= 30 days). Hybrid: system collects, operator confirms.
-- ---------------------------------------------------------------------------
create table rotation_pool (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null references people(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  from_profile_id     uuid references sender_profiles(id) on delete set null,
  to_profile_id       uuid references sender_profiles(id) on delete set null,
  source_assignment_id uuid references lead_assignments(id) on delete cascade,
  eligible_at         timestamptz not null default now(),
  status              pool_status not null default 'pending',
  created_at          timestamptz not null default now()
);
create index on rotation_pool (client_id, status);

-- ---------------------------------------------------------------------------
-- Follow-up pool — non-responders eligible for the next follow-up campaign
-- ---------------------------------------------------------------------------
create table followup_pool (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null references people(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  source_campaign_id  uuid references campaigns(id) on delete set null,
  source_assignment_id uuid references lead_assignments(id) on delete cascade,
  eligible_at         timestamptz not null default now(),
  status              pool_status not null default 'pending',
  created_at          timestamptz not null default now()
);
create index on followup_pool (client_id, status);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger lead_assignments_updated_at
  before update on lead_assignments
  for each row execute function set_updated_at();

create trigger connection_status_updated_at
  before update on connection_status
  for each row execute function set_updated_at();
