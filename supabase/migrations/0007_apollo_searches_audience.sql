alter table apollo_searches
  add column if not exists audience_id    uuid references audiences(id) on delete set null,
  add column if not exists campaign_id    uuid references campaigns(id) on delete set null,
  add column if not exists icp_profile_id uuid references icp_profiles(id) on delete set null;
