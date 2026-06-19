create table if not exists apollo_searches (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  name          text,
  filters       jsonb not null default '{}',
  total_entries int,
  pages_fetched int not null default 0,
  leads_imported int not null default 0,
  per_page      int not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists apollo_searches_client_id_idx on apollo_searches(client_id);
