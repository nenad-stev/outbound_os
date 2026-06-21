-- Widen the claim stale window from 90s → 240s.
-- The pipeline now runs multiple batch workers in parallel and each /start
-- request processes a larger batch (6 leads) with in-request concurrency, so a
-- healthy batch can legitimately take longer than 90s. If the window is shorter
-- than the real processing time, a second worker would re-claim rows that are
-- still being processed → wasted BrightData/AI spend on duplicates. 240s sits
-- comfortably above a healthy batch yet still reclaims a crashed batch's rows
-- well within the client's wait budget.

drop function if exists claim_pending_members(uuid, int);

create or replace function claim_pending_members(p_audience_id uuid, p_limit int default 6)
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
      and (claimed_at is null or claimed_at < now() - interval '240 seconds')
    order by id
    limit p_limit
    for update skip locked
  ) s
  where m.id = s.id
  returning m.*;
$$;
