-- Analytics columns on content_posts (manual entry from LinkedIn)
alter table content_posts
  add column if not exists impressions          int not null default 0,
  add column if not exists likes                int not null default 0,
  add column if not exists comments             int not null default 0,
  add column if not exists shares               int not null default 0,
  add column if not exists analytics_updated_at timestamptz;
