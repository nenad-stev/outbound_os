-- Concurrency guard for the qualify pipeline.
-- Two near-simultaneous POSTs to /api/pipeline/[id]/start (e.g. a gateway
-- retry after the browser connection drops) would otherwise both process the
-- same pending rows, doubling BrightData + AI spend. We add a per-row claim
-- timestamp and an atomic claim function: a single UPDATE ... RETURNING grabs
-- only rows that are still pending and not claimed in the last 5 minutes, so
-- concurrent callers receive disjoint row sets and stale claims (from a timed-
-- out run) become reclaimable.

alter table audience_members
  add column if not exists claimed_at timestamptz;

create or replace function claim_pending_members(p_audience_id uuid)
returns setof audience_members
language sql
as $$
  update audience_members m
  set claimed_at = now()
  where m.audience_id = p_audience_id
    and m.qualify_status = 'pending'
    and (m.claimed_at is null or m.claimed_at < now() - interval '5 minutes')
  returning m.*;
$$;
