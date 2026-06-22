create table if not exists public.shadow_compare_runs (
  id uuid primary key default gen_random_uuid(),
  issue_date date not null,
  matched boolean not null,
  difference_count integer not null check (difference_count >= 0),
  difference_paths jsonb not null default '[]'::jsonb,
  json_duration_ms integer not null check (json_duration_ms >= 0),
  supabase_duration_ms integer not null check (supabase_duration_ms >= 0),
  error_code text,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists shadow_compare_runs_created_at_idx
  on public.shadow_compare_runs(created_at desc);

create index if not exists shadow_compare_runs_issue_date_created_at_idx
  on public.shadow_compare_runs(issue_date, created_at desc);

alter table public.shadow_compare_runs enable row level security;

revoke all on table public.shadow_compare_runs from anon, authenticated;
grant select, insert on table public.shadow_compare_runs to service_role;
