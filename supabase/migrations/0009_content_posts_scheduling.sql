-- LinkedIn post scheduling via n8n.
-- New 'scheduled' status + the time it should go out + the resulting post URL.

alter type post_status add value if not exists 'scheduled';

alter table content_posts
  add column if not exists scheduled_at      timestamptz,
  add column if not exists linkedin_post_url text;

create index if not exists content_posts_scheduled_idx
  on content_posts (status, scheduled_at);
