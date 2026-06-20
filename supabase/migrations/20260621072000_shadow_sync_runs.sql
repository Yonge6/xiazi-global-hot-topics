alter table public.shadow_compare_runs
  alter column issue_date drop not null,
  add column if not exists trigger_type text not null default 'manual',
  add column if not exists sync_status text,
  add column if not exists sync_changed boolean,
  add column if not exists source_issue_date date,
  add column if not exists source_checksum text,
  add column if not exists sync_error_code text,
  add column if not exists sync_duration_ms integer,
  add column if not exists compare_status text,
  add column if not exists deployment_id text,
  add column if not exists execution_key text;

alter table public.shadow_compare_runs
  drop constraint if exists shadow_compare_runs_trigger_type_check,
  add constraint shadow_compare_runs_trigger_type_check
    check (trigger_type in ('cron', 'manual'));

alter table public.shadow_compare_runs
  drop constraint if exists shadow_compare_runs_sync_status_check,
  add constraint shadow_compare_runs_sync_status_check
    check (sync_status is null or sync_status in ('skipped', 'inserted', 'updated', 'failed'));

alter table public.shadow_compare_runs
  drop constraint if exists shadow_compare_runs_compare_status_check,
  add constraint shadow_compare_runs_compare_status_check
    check (compare_status is null or compare_status in ('matched', 'mismatch', 'failed'));

alter table public.shadow_compare_runs
  drop constraint if exists shadow_compare_runs_sync_duration_check,
  add constraint shadow_compare_runs_sync_duration_check
    check (sync_duration_ms is null or sync_duration_ms >= 0);

update public.shadow_compare_runs
set source_issue_date = issue_date
where source_issue_date is null
  and issue_date is not null;

create index if not exists shadow_compare_runs_trigger_created_at_idx
  on public.shadow_compare_runs(trigger_type, created_at desc);

create index if not exists shadow_compare_runs_source_issue_created_at_idx
  on public.shadow_compare_runs(source_issue_date, created_at desc);

create or replace function public.upsert_issue_bundle_with_lock(lock_key text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if lock_key is null or lock_key = '' then
    raise exception 'lock_key is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(lock_key));
  result := public.upsert_issue_bundle(payload);
  return result;
end;
$$;

revoke execute on function public.upsert_issue_bundle_with_lock(text, jsonb) from public;
revoke execute on function public.upsert_issue_bundle_with_lock(text, jsonb) from anon;
revoke execute on function public.upsert_issue_bundle_with_lock(text, jsonb) from authenticated;
grant execute on function public.upsert_issue_bundle_with_lock(text, jsonb) to service_role;
