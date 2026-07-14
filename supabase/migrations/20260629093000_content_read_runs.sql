create table if not exists public.content_read_runs (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  path_type text not null,
  issue_date date,
  primary_source text not null,
  fallback_used boolean not null default false,
  fallback_reason text,
  supabase_duration_ms integer check (supabase_duration_ms is null or supabase_duration_ms >= 0),
  json_duration_ms integer check (json_duration_ms is null or json_duration_ms >= 0),
  matched boolean,
  difference_count integer check (difference_count is null or difference_count >= 0),
  difference_paths jsonb not null default '[]'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  constraint content_read_runs_path_type_check
    check (path_type in ('latest', 'issue', 'archive')),
  constraint content_read_runs_primary_source_check
    check (primary_source in ('supabase', 'json')),
  constraint content_read_runs_fallback_reason_check
    check (
      fallback_reason is null or fallback_reason in (
        'SUPABASE_READ_FAILED',
        'SUPABASE_TIMEOUT',
        'SUPABASE_ISSUE_MISSING',
        'SUPABASE_CONTRACT_INVALID',
        'SUPABASE_ARCHIVE_FAILED',
        'SUPABASE_UNKNOWN_ERROR'
      )
    )
);

create index if not exists content_read_runs_created_at_idx
  on public.content_read_runs(created_at desc);

create index if not exists content_read_runs_fallback_created_at_idx
  on public.content_read_runs(fallback_used, created_at desc);

alter table public.content_read_runs enable row level security;

revoke all on table public.content_read_runs from anon;
revoke all on table public.content_read_runs from authenticated;
grant select, insert on table public.content_read_runs to service_role;
