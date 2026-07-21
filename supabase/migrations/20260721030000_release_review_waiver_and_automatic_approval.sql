alter table public.publication_releases
  add column if not exists review_status text not null default 'passed',
  add column if not exists review_passed boolean not null default true,
  add column if not exists review_waived boolean not null default false,
  add column if not exists waiver_id text,
  add column if not exists waiver_reason text,
  add column if not exists waiver_configured_by text,
  add column if not exists waiver_configured_at timestamptz;

alter table public.publication_releases
  drop constraint if exists publication_releases_review_status_check,
  add constraint publication_releases_review_status_check check (
    (review_status = 'passed' and review_passed and not review_waived
      and waiver_id is null and waiver_reason is null
      and waiver_configured_by is null and waiver_configured_at is null)
    or
    (review_status = 'waived' and not review_passed and review_waived
      and length(trim(waiver_id)) >= 12 and length(trim(waiver_reason)) >= 24
      and length(trim(waiver_configured_by)) >= 3 and waiver_configured_at is not null)
  );

alter table public.publication_source_snapshots
  add column if not exists review_status text not null default 'passed';

alter table public.publication_source_snapshots
  drop constraint if exists publication_source_review_status_check,
  add constraint publication_source_review_status_check check (
    (review_status = 'passed' and supports_claim and jsonb_array_length(claim_results) = 4 and review_provider <> 'none')
    or
    (review_status = 'waived' and not supports_claim and jsonb_array_length(claim_results) = 0
      and review_provider = 'none' and review_model is null)
  );

alter table public.publication_poster_checks
  add column if not exists verification_method text not null default 'reviewer',
  add column if not exists manifest_number smallint,
  add column if not exists manifest_language text,
  add column if not exists manifest_issue_date date,
  add column if not exists manifest_site text,
  add column if not exists ocr_performed boolean not null default true,
  add column if not exists semantic_comparison_performed boolean not null default true,
  add column if not exists review_status text not null default 'passed';

update public.publication_poster_checks poster
set manifest_number = poster.detected_number,
    manifest_language = poster.locale,
    manifest_issue_date = release.issue_date,
    manifest_site = 'xiazishuo.com'
from public.publication_releases release
where release.release_id = poster.release_id
  and (poster.manifest_number is null or poster.manifest_language is null
    or poster.manifest_issue_date is null or poster.manifest_site is null);

alter table public.publication_poster_checks
  alter column manifest_number set not null,
  alter column manifest_language set not null,
  alter column manifest_issue_date set not null,
  alter column manifest_site set not null,
  drop constraint if exists publication_poster_verification_method_check,
  add constraint publication_poster_verification_method_check check (
    verification_method in ('reviewer', 'deterministic-manifest')
    and manifest_number between 1 and 9
    and manifest_language = locale
    and manifest_site = 'xiazishuo.com'
    and (
      (review_status = 'passed' and verification_method = 'reviewer'
        and ocr_performed and semantic_comparison_performed and review_provider <> 'none')
      or
      (review_status = 'waived' and verification_method = 'deterministic-manifest'
        and not ocr_performed and not semantic_comparison_performed
        and review_provider = 'none' and review_model is null
        and not title_matches and not date_matches and not site_matches
        and not theme_matches and not xiazi_matches and not doudoulong_matches)
    )
  );

create or replace function public.populate_publication_release_review_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.review_status := new.validation_report->>'reviewStatus';
  new.review_passed := coalesce((new.validation_report->>'reviewPassed')::boolean, false);
  new.review_waived := coalesce((new.validation_report->>'reviewWaived')::boolean, false);
  new.waiver_id := new.validation_report->>'waiverId';
  new.waiver_reason := new.validation_report->>'waiverReason';
  new.waiver_configured_by := new.validation_report->>'configuredBy';
  new.waiver_configured_at := (new.validation_report->>'configuredAt')::timestamptz;
  if new.review_status not in ('passed', 'waived') then raise exception 'RELEASE_REVIEW_STATUS_INVALID'; end if;
  return new;
end;
$$;

drop trigger if exists publication_release_review_fields on public.publication_releases;
create trigger publication_release_review_fields
before insert on public.publication_releases
for each row execute function public.populate_publication_release_review_fields();

create or replace function public.populate_publication_source_review_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.review_status := case when new.review_provider = 'none' then 'waived' else 'passed' end;
  return new;
end;
$$;

drop trigger if exists publication_source_review_fields on public.publication_source_snapshots;
create trigger publication_source_review_fields
before insert on public.publication_source_snapshots
for each row execute function public.populate_publication_source_review_fields();

create or replace function public.populate_publication_poster_verification_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  release public.publication_releases%rowtype;
begin
  select * into release from public.publication_releases where release_id = new.release_id;
  if release.release_id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  new.review_status := case when new.review_provider = 'none' then 'waived' else 'passed' end;
  new.verification_method := case when new.review_status = 'waived' then 'deterministic-manifest' else 'reviewer' end;
  new.manifest_number := new.detected_number;
  new.manifest_language := new.locale;
  new.manifest_issue_date := release.issue_date;
  new.manifest_site := 'xiazishuo.com';
  new.ocr_performed := new.review_status = 'passed';
  new.semantic_comparison_performed := new.review_status = 'passed';
  return new;
end;
$$;

drop trigger if exists publication_poster_verification_fields on public.publication_poster_checks;
create trigger publication_poster_verification_fields
before insert on public.publication_poster_checks
for each row execute function public.populate_publication_poster_verification_fields();

create or replace function public.reject_publication_release_payload_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.release_id is distinct from old.release_id
    or new.issue_date is distinct from old.issue_date
    or new.content_hash is distinct from old.content_hash
    or new.release_hash is distinct from old.release_hash
    or new.schema_version is distinct from old.schema_version
    or new.issue is distinct from old.issue
    or new.source_snapshot_hash is distinct from old.source_snapshot_hash
    or new.poster_manifest_hash is distinct from old.poster_manifest_hash
    or new.validation_report is distinct from old.validation_report
    or new.review_status is distinct from old.review_status
    or new.review_passed is distinct from old.review_passed
    or new.review_waived is distinct from old.review_waived
    or new.waiver_id is distinct from old.waiver_id
    or new.waiver_reason is distinct from old.waiver_reason
    or new.waiver_configured_by is distinct from old.waiver_configured_by
    or new.waiver_configured_at is distinct from old.waiver_configured_at
    or new.data_source is distinct from old.data_source
    or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_RELEASE_PAYLOAD';
  end if;
  return new;
end;
$$;

alter table public.publication_activation_requests
  add column if not exists activation_mode text not null default 'human',
  add column if not exists validation_hash text,
  add column if not exists waiver_id text,
  add column if not exists job_id text,
  add column if not exists commit_sha text,
  add column if not exists activated_at timestamptz;

alter table public.publication_activation_requests
  drop constraint if exists publication_activation_requests_mode_check,
  add constraint publication_activation_requests_mode_check check (activation_mode in ('human', 'automatic'));

alter table public.publication_channel_events
  add column if not exists activation_mode text not null default 'human',
  add column if not exists validation_hash text,
  add column if not exists waiver_id text,
  add column if not exists job_id text,
  add column if not exists commit_sha text,
  add column if not exists activated_at timestamptz;

alter table public.publication_channel_events
  drop constraint if exists publication_channel_events_mode_check,
  add constraint publication_channel_events_mode_check check (activation_mode in ('human', 'automatic'));

drop function if exists public.activate_publication_release(text, text, text);
create function public.activate_publication_release(
  p_release_id text,
  p_approver text,
  p_activation_key text,
  p_activation_mode text default 'human',
  p_commit_sha text default null,
  p_validation_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.publication_releases%rowtype;
  previous_release text;
  current_release text;
  existing_request public.publication_activation_requests%rowtype;
  job public.publication_jobs%rowtype;
  activated_time timestamptz := now();
begin
  if p_activation_mode not in ('human', 'automatic') then raise exception 'ACTIVATION_MODE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('publication-channel:current', 0));
  select * into existing_request from public.publication_activation_requests where activation_key = p_activation_key;
  if existing_request.activation_key is not null then
    if existing_request.release_id <> p_release_id or existing_request.action <> 'activate'
      or existing_request.activation_mode <> p_activation_mode then
      raise exception 'ACTIVATION_KEY_CONFLICT';
    end if;
    select active_release_id into current_release from public.publication_channels where channel = 'current';
    return jsonb_build_object(
      'idempotent', true,
      'requestedReleaseId', p_release_id,
      'currentActiveReleaseId', current_release,
      'requestPreviouslyCompleted', true,
      'activationMode', existing_request.activation_mode
    );
  end if;

  select * into candidate from public.publication_releases where release_id = p_release_id for update;
  if candidate.release_id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if candidate.issue_date <= date '2026-07-18' then raise exception 'HISTORICAL_RELEASE_OUT_OF_SCOPE'; end if;
  if candidate.status <> 'ready_for_approval' then raise exception 'RELEASE_NOT_READY_FOR_APPROVAL'; end if;
  if coalesce((candidate.validation_report->>'passed')::boolean, false) is not true then raise exception 'RELEASE_VALIDATION_NOT_PASSED'; end if;
  if candidate.review_status = 'waived' and (candidate.review_passed or not candidate.review_waived or candidate.waiver_id is null) then
    raise exception 'RELEASE_REVIEW_WAIVER_INVALID';
  end if;
  if candidate.review_status = 'passed' and (not candidate.review_passed or candidate.review_waived) then
    raise exception 'RELEASE_REVIEW_STATUS_INVALID';
  end if;

  select * into job from public.publication_jobs where release_id = p_release_id for update;
  if p_activation_mode = 'automatic' then
    if p_commit_sha !~ '^[0-9a-f]{40}$' then raise exception 'AUTOMATIC_ACTIVATION_COMMIT_SHA_REQUIRED'; end if;
    if p_validation_hash !~ '^[0-9a-f]{64}$' then raise exception 'AUTOMATIC_ACTIVATION_VALIDATION_HASH_REQUIRED'; end if;
    if job.issue_date is null or job.status <> 'staged' or job.lease_expires_at <= now() then
      raise exception 'AUTOMATIC_ACTIVATION_LIVE_LEASE_REQUIRED';
    end if;
    if (candidate.validation_report->>'sourceCount')::integer < 8
      or (candidate.validation_report->>'posterCount')::integer <> 18 then
      raise exception 'AUTOMATIC_ACTIVATION_MANIFEST_INCOMPLETE';
    end if;
    if coalesce((candidate.validation_report#>>'{storageVerification,policyVerified}')::boolean, false) is not true
      or coalesce((candidate.validation_report#>>'{storageVerification,overwriteDenied}')::boolean, false) is not true
      or coalesce((candidate.validation_report#>>'{storageVerification,deleteDenied}')::boolean, false) is not true then
      raise exception 'AUTOMATIC_ACTIVATION_STORAGE_UNVERIFIED';
    end if;
  end if;

  select active_release_id into previous_release from public.publication_channels where channel = 'current' for update;
  if previous_release is not null and previous_release <> p_release_id then
    update public.publication_releases set status = 'superseded' where release_id = previous_release;
  end if;
  update public.publication_releases
  set status = 'active', supersedes_release_id = previous_release, approved_at = activated_time,
      approved_by = p_approver, activated_at = activated_time, deployed_at = activated_time
  where release_id = p_release_id;
  update public.publication_channels
  set active_release_id = p_release_id, pointer_version = pointer_version + 1, updated_at = activated_time
  where channel = 'current';
  insert into public.publication_activation_requests (
    activation_key, release_id, action, actor, activation_mode, validation_hash,
    waiver_id, job_id, commit_sha, activated_at
  ) values (
    p_activation_key, p_release_id, 'activate', p_approver, p_activation_mode, p_validation_hash,
    candidate.waiver_id, job.idempotency_key, p_commit_sha, activated_time
  );
  insert into public.publication_channel_events (
    channel, previous_release_id, next_release_id, action, actor, activation_key,
    activation_mode, validation_hash, waiver_id, job_id, commit_sha, activated_at
  ) values (
    'current', previous_release, p_release_id, 'activate', p_approver, p_activation_key,
    p_activation_mode, p_validation_hash, candidate.waiver_id, job.idempotency_key, p_commit_sha, activated_time
  );
  update public.publication_jobs set status = 'activated', updated_at = activated_time where release_id = p_release_id;

  return jsonb_build_object(
    'idempotent', false,
    'requestedReleaseId', p_release_id,
    'currentActiveReleaseId', p_release_id,
    'previousReleaseId', previous_release,
    'requestPreviouslyCompleted', false,
    'activationMode', p_activation_mode,
    'waiverId', candidate.waiver_id,
    'deployedAt', activated_time
  );
end;
$$;

create or replace function public.get_active_publication_release()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when release.release_id is null then null
    else jsonb_build_object(
      'issue', release.issue,
      'metadata', jsonb_build_object(
        'releaseId', release.release_id,
        'releaseSchemaVersion', release.schema_version,
        'contentHash', release.content_hash,
        'dataSource', release.data_source,
        'deployedAt', release.deployed_at,
        'publicationHealth', 'healthy',
        'stale', false,
        'reviewStatus', release.review_status,
        'reviewPassed', release.review_passed,
        'reviewWaived', release.review_waived,
        'waiverId', release.waiver_id,
        'waiverReason', release.waiver_reason,
        'configuredBy', release.waiver_configured_by,
        'configuredAt', release.waiver_configured_at
      )
    )
  end
  from public.publication_channels channel
  left join public.publication_releases release on release.release_id = channel.active_release_id
  where channel.channel = 'current';
$$;

revoke all on function public.activate_publication_release(text, text, text, text, text, text) from public;
grant execute on function public.activate_publication_release(text, text, text, text, text, text) to service_role;
