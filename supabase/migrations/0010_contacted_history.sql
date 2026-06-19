-- Tracks people already contacted via external tools (LGM, HeyReach, etc.)
-- Used for per-client dedup: pipeline marks matched leads as disqualified.
create table contacted_history (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  batch_id     uuid not null,           -- shared across all rows in one upload
  batch_name   text not null,           -- CSV filename or manual label
  source       text not null default 'lgm',  -- 'lgm' | 'apollo' | 'heyreach' | 'manual'
  linkedin_url text,
  email        text,
  first_name   text,
  last_name    text,
  uploaded_at  timestamptz not null default now()
);

create index on contacted_history (client_id);
create index on contacted_history (batch_id);
create index on contacted_history (client_id, lower(linkedin_url)) where linkedin_url is not null;
create index on contacted_history (client_id, lower(email)) where email is not null;
