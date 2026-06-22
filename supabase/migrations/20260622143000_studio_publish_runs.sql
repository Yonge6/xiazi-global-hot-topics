create table if not exists public.studio_publish_runs (
  id uuid primary key default gen_random_uuid(),
  publish_request_id text not null unique,
  issue_date date not null,
  checksum text not null,
  trigger_type text not null default 'studio',
  primary_target text not null default 'github',
  primary_status text not null default 'pending',
  primary_commit_sha text,
  shadow_status text not null default 'not_started',
  shadow_changed boolean,
  compare_status text not null default 'not_started',
  difference_count integer not null default 0,
  difference_paths jsonb not null default '[]'::jsonb,
  retry_count integer not null default 0,
  error_stage text,
  error_code text,
  deployment_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_publish_runs_trigger_type_check
    check (trigger_type in ('studio', 'retry')),
  constraint studio_publish_runs_primary_target_check
    check (primary_target in ('github')),
  constraint studio_publish_runs_primary_status_check
    check (primary_status in ('pending', 'succeeded', 'failed')),
  constraint studio_publish_runs_shadow_status_check
    check (shadow_status in ('not_started', 'succeeded', 'skipped', 'failed', 'timeout')),
  constraint studio_publish_runs_compare_status_check
    check (compare_status in ('not_started', 'matched', 'mismatched', 'failed')),
  constraint studio_publish_runs_difference_count_check
    check (difference_count >= 0),
  constraint studio_publish_runs_retry_count_check
    check (retry_count >= 0)
);

create index if not exists studio_publish_runs_issue_date_created_at_idx
  on public.studio_publish_runs(issue_date, created_at desc);

create index if not exists studio_publish_runs_shadow_status_created_at_idx
  on public.studio_publish_runs(shadow_status, created_at desc);

create or replace function public.set_studio_publish_runs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists studio_publish_runs_set_updated_at on public.studio_publish_runs;
create trigger studio_publish_runs_set_updated_at
before update on public.studio_publish_runs
for each row execute function public.set_studio_publish_runs_updated_at();

alter table public.studio_publish_runs enable row level security;

drop policy if exists "Service role can manage studio publish runs" on public.studio_publish_runs;
create policy "Service role can manage studio publish runs"
  on public.studio_publish_runs
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.studio_publish_runs from anon;
revoke all on table public.studio_publish_runs from authenticated;
