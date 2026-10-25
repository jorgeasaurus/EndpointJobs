-- User data for Endpoint Jobs accounts.
--
-- Deviations from the plan's sketch, and why:
-- * language plpgsql instead of sql, so a null auth.uid() raises 42501
--   instead of inserting nothing or failing as a not-null violation.
-- * SET search_path = '' so the function cannot be tricked into another schema.
-- * FORCE ROW LEVEL SECURITY, so the table owner is also subject to policies.
--   service_role still bypasses RLS (BYPASSRLS) for a later account-deletion path.
-- * Explicit grants: authenticated gets DML, service_role gets ALL, anon and
--   PUBLIC get nothing. New tables are not left to default privileges.
-- * EXECUTE on record_job_view is revoked from PUBLIC and anon.
-- * Blank emails, privacy versions, and job ids are rejected. job_id is capped
--   at 512 characters (current feed ids are under 150). view_count must stay >= 1.
-- * Policies compare against (select auth.uid()) so the uid is planned once.
--   A null uid matches no rows, because NULL equality is not true.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default pg_catalog.now(),
  privacy_version_accepted text not null,
  constraint profiles_email_not_blank check (char_length(btrim(email)) > 0),
  constraint profiles_privacy_version_not_blank check (char_length(btrim(privacy_version_accepted)) > 0)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  filters jsonb not null default '{}'::jsonb,
  schema_version int not null default 1,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint user_preferences_filters_object check (jsonb_typeof(filters) = 'object'),
  constraint user_preferences_schema_version_positive check (schema_version >= 1)
);

create table public.saved_jobs (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id text not null,
  job_snapshot jsonb not null,
  saved_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, job_id),
  constraint saved_jobs_job_id_present check (char_length(btrim(job_id)) between 1 and 512),
  constraint saved_jobs_snapshot_object check (jsonb_typeof(job_snapshot) = 'object')
);

create table public.job_views (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id text not null,
  first_viewed_at timestamptz not null default pg_catalog.now(),
  last_viewed_at timestamptz not null default pg_catalog.now(),
  view_count int not null default 1,
  primary key (user_id, job_id),
  constraint job_views_job_id_present check (char_length(btrim(job_id)) between 1 and 512),
  constraint job_views_count_positive check (view_count >= 1)
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.job_views enable row level security;

alter table public.profiles force row level security;
alter table public.user_preferences force row level security;
alter table public.saved_jobs force row level security;
alter table public.job_views force row level security;

create policy own_profile on public.profiles
  for all
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy own_prefs on public.user_preferences
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy own_saved on public.saved_jobs
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy own_views on public.job_views
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.user_preferences from public, anon, authenticated;
revoke all on table public.saved_jobs from public, anon, authenticated;
revoke all on table public.job_views from public, anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;
grant select, insert, update, delete on table public.saved_jobs to authenticated;
grant select, insert, update, delete on table public.job_views to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.user_preferences to service_role;
grant all on table public.saved_jobs to service_role;
grant all on table public.job_views to service_role;

create function public.record_job_view(p_job_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_job_id is null or char_length(btrim(p_job_id)) = 0 then
    raise exception 'job id required' using errcode = '22023';
  end if;

  insert into public.job_views (user_id, job_id)
  values (auth.uid(), p_job_id)
  on conflict (user_id, job_id) do update
    set last_viewed_at = pg_catalog.now(),
        view_count = public.job_views.view_count + 1;
end;
$$;

revoke all on function public.record_job_view(text) from public, anon;
grant execute on function public.record_job_view(text) to authenticated, service_role;
