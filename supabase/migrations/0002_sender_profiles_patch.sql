-- Rename name → full_name, add daily_limit and notes to sender_profiles
alter table sender_profiles rename column name to full_name;
alter table sender_profiles add column if not exists daily_limit int not null default 20;
alter table sender_profiles add column if not exists notes text;
