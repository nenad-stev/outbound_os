-- Content OS — per-sender-profile content strategy, pillars, and generated posts.

create type post_type   as enum ('text', 'image', 'carousel');
create type post_status as enum ('draft', 'approved', 'published', 'archived');
create type post_source as enum ('pillar', 'inspiration', 'adhoc');

-- ---------------------------------------------------------------------------
-- Content strategy (one per sender profile)
-- ---------------------------------------------------------------------------
create table content_strategies (
  id                  uuid primary key default gen_random_uuid(),
  sender_profile_id   uuid not null references sender_profiles(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  about_me            text,         -- who the sender is, background, expertise
  tone_voice          text,         -- e.g. "direktan, stručan, bez korporativnih fraza"
  target_audience     text,         -- who reads their content
  posting_frequency   text,         -- e.g. "3× nedeljno"
  extra_rules         text,         -- anything else: no emojis, always end with Q, etc.
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (sender_profile_id)
);
create index on content_strategies (client_id);

create trigger content_strategies_updated_at
  before update on content_strategies
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Content pillars (belonging to a strategy)
-- ---------------------------------------------------------------------------
create table content_pillars (
  id          uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references content_strategies(id) on delete cascade,
  name        text not null,
  description text,
  example_topics text[] default '{}',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index on content_pillars (strategy_id);

-- ---------------------------------------------------------------------------
-- Generated posts
-- ---------------------------------------------------------------------------
create table content_posts (
  id                  uuid primary key default gen_random_uuid(),
  sender_profile_id   uuid not null references sender_profiles(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  pillar_id           uuid references content_pillars(id) on delete set null,
  post_type           post_type not null default 'text',
  status              post_status not null default 'draft',
  source              post_source not null default 'adhoc',
  topic               text,                  -- brief / angle supplied by operator
  content             text,                  -- final post text (editable)
  slides              jsonb,                 -- carousel: [{title, body, cta?}]
  image_prompt        text,                  -- image posts: visual brief for designer/AI
  inspiration_texts   text[] default '{}',   -- pasted inspiration posts
  generated_at        timestamptz,
  published_at        timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on content_posts (client_id, status);
create index on content_posts (sender_profile_id);

create trigger content_posts_updated_at
  before update on content_posts
  for each row execute function set_updated_at();
