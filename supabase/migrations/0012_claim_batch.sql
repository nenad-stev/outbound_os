-- Batched claim for the qualify pipeline.
-- BrightData scraping is slow (synchronous, up to ~3 min), so processing a
-- whole audience in one request blows past Vercel's function limit and the run
-- gets cut mid-way. The client now drives the pipeline in small batches; this
-- function claims up to p_limit pending rows at a time using FOR UPDATE SKIP
-- LOCKED so concurrent callers never grab the same row. The stale window is
-- short (90s) so a batch killed by a timeout becomes reclaimable quickly.

drop function if exists claim_pending_members(uuid);

create or replace function claim_pending_members(p_audience_id uuid, p_limit int default 3)
returns setof audience_members
language sql
as $$
  update audience_members m
  set claimed_at = now()
  from (
    select id
    from audience_members
    where audience_id = p_audience_id
      and qualify_status = 'pending'
      and (claimed_at is null or claimed_at < now() - interval '90 seconds')
    order by id
    limit p_limit
    for update skip locked
  ) s
  where m.id = s.id
  returning m.*;
$$;
