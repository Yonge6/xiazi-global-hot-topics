create table if not exists public.publication_releases (
  release_id text primary key,
  issue_date date not null,
  content_hash text not null,
  issue jsonb not null,
  status text not null default 'validating',
  source_snapshot_hash text,
  poster_manifest_hash text,
  validation_report jsonb not null default '{"passed":false,"failures":["validation not completed"]}'::jsonb,
  data_source text not null default 'supabase-release',
  supersedes_release_id text references public.publication_releases(release_id),
  staged_at timestamptz not null default now(),
  ready_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  activated_at timestamptz,
  deployed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint publication_releases_future_only_check check (issue_date > date '2026-07-18'),
  constraint publication_releases_content_hash_check check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint publication_releases_source_hash_check check (source_snapshot_hash is null or source_snapshot_hash ~ '^[0-9a-f]{64}$'),
  constraint publication_releases_poster_hash_check check (poster_manifest_hash is null or poster_manifest_hash ~ '^[0-9a-f]{64}$'),
  constraint publication_releases_status_check check (status in ('validating', 'ready_for_approval', 'active', 'superseded', 'failed')),
  constraint publication_releases_source_check check (data_source = 'supabase-release'),
  constraint publication_releases_issue_content_unique unique (issue_date, content_hash)
);

create table if not exists public.publication_source_snapshots (
  release_id text not null references public.publication_releases(release_id) on delete restrict,
  source_id text not null,
  topic_id text not null,
  url text not null,
  final_url text not null,
  fetched_at timestamptz not null,
  http_status smallint not null,
  title text not null,
  content_hash text not null,
  snapshot_text text not null,
  correction_status text not null,
  supports_claim boolean not null,
  review_provider text not null,
  review_model text,
  rationale text not null,
  created_at timestamptz not null default now(),
  primary key (release_id, source_id),
  constraint publication_source_snapshots_http_check check (http_status between 200 and 399),
  constraint publication_source_snapshots_hash_check check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint publication_source_snapshots_correction_check check (correction_status in ('clear', 'corrected', 'retracted'))
);

create index if not exists publication_source_snapshots_topic_idx
  on public.publication_source_snapshots (release_id, topic_id);

create table if not exists public.publication_poster_checks (
  release_id text not null references public.publication_releases(release_id) on delete restrict,
  topic_id text not null,
  locale text not null,
  url text not null,
  content_hash text not null,
  width integer not null,
  height integer not null,
  format text not null,
  ocr_text_hash text not null,
  detected_number smallint not null,
  detected_language text not null,
  title_matches boolean not null,
  date_matches boolean not null,
  site_matches boolean not null,
  theme_matches boolean not null,
  xiazi_matches boolean not null,
  doudoulong_matches boolean not null,
  duplicate_of text,
  review_provider text not null,
  review_model text,
  checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (release_id, topic_id, locale),
  constraint publication_poster_checks_locale_check check (locale in ('zh', 'en')),
  constraint publication_poster_checks_language_check check (detected_language in ('zh', 'en')),
  constraint publication_poster_checks_format_check check (format = 'png'),
  constraint publication_poster_checks_hash_check check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint publication_poster_checks_ocr_hash_check check (ocr_text_hash ~ '^[0-9a-f]{64}$'),
  constraint publication_poster_checks_number_check check (detected_number between 1 and 9),
  constraint publication_poster_checks_dimensions_check check (width >= 800 and height >= 1600 and width * 2 = height),
  constraint publication_poster_checks_no_duplicate_check check (duplicate_of is null)
);

create unique index if not exists publication_poster_checks_release_hash_unique_idx
  on public.publication_poster_checks (release_id, content_hash);

create or replace function public.reject_publication_release_payload_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.release_id is distinct from old.release_id
    or new.issue_date is distinct from old.issue_date
    or new.content_hash is distinct from old.content_hash
    or new.issue is distinct from old.issue
    or new.source_snapshot_hash is distinct from old.source_snapshot_hash
    or new.poster_manifest_hash is distinct from old.poster_manifest_hash
    or new.validation_report is distinct from old.validation_report
    or new.data_source is distinct from old.data_source
    or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_RELEASE_PAYLOAD';
  end if;
  return new;
end;
$$;

drop trigger if exists publication_releases_immutable_payload on public.publication_releases;
create trigger publication_releases_immutable_payload
before update on public.publication_releases
for each row execute function public.reject_publication_release_payload_mutation();

create table if not exists public.publication_channels (
  channel text primary key,
  active_release_id text references public.publication_releases(release_id) on delete restrict,
  pointer_version bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint publication_channels_name_check check (channel in ('current'))
);

insert into public.publication_channels (channel, active_release_id)
values ('current', null)
on conflict (channel) do nothing;

create table if not exists public.publication_jobs (
  issue_date date primary key,
  idempotency_key text not null unique,
  lease_owner text not null,
  lease_expires_at timestamptz not null,
  heartbeat_at timestamptz not null default now(),
  status text not null default 'leased',
  release_id text references public.publication_releases(release_id) on delete restrict,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_jobs_future_only_check check (issue_date > date '2026-07-18'),
  constraint publication_jobs_status_check check (status in ('leased', 'validating', 'staged', 'activated', 'failed'))
);

create index if not exists publication_jobs_status_expiry_idx
  on public.publication_jobs (status, lease_expires_at);

create table if not exists public.publication_activation_requests (
  activation_key text primary key,
  release_id text not null references public.publication_releases(release_id) on delete restrict,
  action text not null,
  actor text not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint publication_activation_requests_action_check check (action in ('activate', 'rollback'))
);

create table if not exists public.publication_channel_events (
  id bigint generated always as identity primary key,
  channel text not null,
  previous_release_id text references public.publication_releases(release_id) on delete restrict,
  next_release_id text not null references public.publication_releases(release_id) on delete restrict,
  action text not null,
  actor text not null,
  reason text,
  activation_key text not null references public.publication_activation_requests(activation_key) on delete restrict,
  created_at timestamptz not null default now(),
  constraint publication_channel_events_action_check check (action in ('activate', 'rollback'))
);

create index if not exists publication_channel_events_channel_created_idx
  on public.publication_channel_events (channel, created_at desc);

alter table public.publication_releases enable row level security;
alter table public.publication_source_snapshots enable row level security;
alter table public.publication_poster_checks enable row level security;
alter table public.publication_channels enable row level security;
alter table public.publication_jobs enable row level security;
alter table public.publication_activation_requests enable row level security;
alter table public.publication_channel_events enable row level security;

revoke all on table public.publication_releases from anon, authenticated;
revoke all on table public.publication_source_snapshots from anon, authenticated;
revoke all on table public.publication_poster_checks from anon, authenticated;
revoke all on table public.publication_channels from anon, authenticated;
revoke all on table public.publication_jobs from anon, authenticated;
revoke all on table public.publication_activation_requests from anon, authenticated;
revoke all on table public.publication_channel_events from anon, authenticated;

grant select, insert, update on table public.publication_releases to service_role;
grant select, insert on table public.publication_source_snapshots to service_role;
grant select, insert on table public.publication_poster_checks to service_role;
grant select, insert, update on table public.publication_channels to service_role;
grant select, insert, update on table public.publication_jobs to service_role;
grant select, insert on table public.publication_activation_requests to service_role;
grant select, insert on table public.publication_channel_events to service_role;
grant usage, select on sequence public.publication_channel_events_id_seq to service_role;

create or replace function public.acquire_publication_lease(
  p_issue_date date,
  p_idempotency_key text,
  p_lease_owner text,
  p_lease_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.publication_jobs%rowtype;
begin
  if p_issue_date <= date '2026-07-18' then
    raise exception 'HISTORICAL_RELEASE_OUT_OF_SCOPE';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'INVALID_LEASE_DURATION';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('publication-lease:' || p_issue_date::text, 0));

  insert into public.publication_jobs (
    issue_date, idempotency_key, lease_owner, lease_expires_at, heartbeat_at, status, updated_at
  ) values (
    p_issue_date, p_idempotency_key, p_lease_owner, now() + make_interval(secs => p_lease_seconds), now(), 'leased', now()
  )
  on conflict (issue_date) do update
    set idempotency_key = excluded.idempotency_key,
        lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        heartbeat_at = now(),
        status = case
          when public.publication_jobs.idempotency_key = excluded.idempotency_key then public.publication_jobs.status
          else 'leased'
        end,
        error_code = null,
        updated_at = now()
    where public.publication_jobs.idempotency_key = excluded.idempotency_key
       or public.publication_jobs.lease_expires_at <= now()
       or public.publication_jobs.status = 'failed'
  returning * into saved;

  if saved.issue_date is null then
    raise exception 'PUBLICATION_LEASE_HELD' using errcode = '55P03';
  end if;

  return jsonb_build_object(
    'issueDate', saved.issue_date,
    'idempotencyKey', saved.idempotency_key,
    'leaseOwner', saved.lease_owner,
    'leaseExpiresAt', saved.lease_expires_at,
    'status', saved.status,
    'releaseId', saved.release_id
  );
end;
$$;

create or replace function public.fail_publication_job(
  p_issue_date date,
  p_idempotency_key text,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.publication_jobs
  set status = 'failed', error_code = left(p_error_code, 120), updated_at = now()
  where issue_date = p_issue_date and idempotency_key = p_idempotency_key;
end;
$$;

create or replace function public.stage_publication_release(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p_release_id text := payload->>'releaseId';
  p_issue_date date := (payload->>'issueDate')::date;
  p_content_hash text := payload->>'contentHash';
  p_idempotency_key text := payload->>'idempotencyKey';
  p_validation jsonb := payload->'validationReport';
  source_item jsonb;
  poster_item jsonb;
  saved public.publication_releases%rowtype;
begin
  if p_issue_date <= date '2026-07-18' then
    raise exception 'HISTORICAL_RELEASE_OUT_OF_SCOPE';
  end if;
  if coalesce((p_validation->>'passed')::boolean, false) is not true then
    raise exception 'RELEASE_VALIDATION_NOT_PASSED';
  end if;
  if jsonb_array_length(coalesce(payload->'posters', '[]'::jsonb)) <> 18 then
    raise exception 'EXPECTED_18_POSTER_CHECKS';
  end if;
  if jsonb_array_length(coalesce(payload->'sources', '[]'::jsonb)) < 8 then
    raise exception 'INSUFFICIENT_SOURCE_SNAPSHOTS';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('publication-stage:' || p_issue_date::text, 0));

  if not exists (
    select 1 from public.publication_jobs
    where issue_date = p_issue_date
      and idempotency_key = p_idempotency_key
      and status in ('leased', 'validating', 'staged')
  ) then
    raise exception 'PUBLICATION_LEASE_REQUIRED';
  end if;

  insert into public.publication_releases (
    release_id, issue_date, content_hash, issue, status,
    source_snapshot_hash, poster_manifest_hash, validation_report, ready_at
  ) values (
    p_release_id,
    p_issue_date,
    p_content_hash,
    payload->'issue',
    'ready_for_approval',
    payload->>'sourceSnapshotHash',
    payload->>'posterManifestHash',
    p_validation,
    now()
  )
  on conflict (release_id) do nothing;

  select * into saved from public.publication_releases where release_id = p_release_id;
  if saved.content_hash <> p_content_hash or saved.issue_date <> p_issue_date then
    raise exception 'RELEASE_ID_CONFLICT';
  end if;

  for source_item in select value from jsonb_array_elements(payload->'sources') loop
    insert into public.publication_source_snapshots (
      release_id, source_id, topic_id, url, final_url, fetched_at, http_status,
      title, content_hash, snapshot_text, correction_status, supports_claim,
      review_provider, review_model, rationale
    ) values (
      p_release_id,
      source_item->>'sourceId',
      source_item->>'topicId',
      source_item->>'url',
      source_item->>'finalUrl',
      (source_item->>'fetchedAt')::timestamptz,
      (source_item->>'httpStatus')::smallint,
      source_item->>'title',
      source_item->>'contentHash',
      source_item->>'snapshotText',
      source_item->>'correctionStatus',
      (source_item->>'supportsClaim')::boolean,
      source_item->>'reviewProvider',
      source_item->>'reviewModel',
      source_item->>'rationale'
    ) on conflict (release_id, source_id) do nothing;
  end loop;

  for poster_item in select value from jsonb_array_elements(payload->'posters') loop
    insert into public.publication_poster_checks (
      release_id, topic_id, locale, url, content_hash, width, height, format,
      ocr_text_hash, detected_number, detected_language, title_matches,
      date_matches, site_matches, theme_matches, xiazi_matches, doudoulong_matches,
      duplicate_of, review_provider, review_model, checked_at
    ) values (
      p_release_id,
      poster_item->>'topicId',
      poster_item->>'locale',
      poster_item->>'url',
      poster_item->>'contentHash',
      (poster_item->>'width')::integer,
      (poster_item->>'height')::integer,
      poster_item->>'format',
      poster_item->>'ocrTextHash',
      (poster_item->>'detectedNumber')::smallint,
      poster_item->>'detectedLanguage',
      (poster_item->>'titleMatches')::boolean,
      (poster_item->>'dateMatches')::boolean,
      (poster_item->>'siteMatches')::boolean,
      (poster_item->>'themeMatches')::boolean,
      (poster_item->>'xiaziMatches')::boolean,
      (poster_item->>'doudoulongMatches')::boolean,
      poster_item->>'duplicateOf',
      poster_item->>'reviewProvider',
      poster_item->>'reviewModel',
      (poster_item->>'checkedAt')::timestamptz
    ) on conflict (release_id, topic_id, locale) do nothing;
  end loop;

  update public.publication_jobs
  set status = 'staged', release_id = p_release_id, updated_at = now()
  where issue_date = p_issue_date and idempotency_key = p_idempotency_key;

  return jsonb_build_object(
    'releaseId', saved.release_id,
    'issueDate', saved.issue_date,
    'contentHash', saved.content_hash,
    'status', saved.status,
    'readyAt', saved.ready_at
  );
end;
$$;

create or replace function public.activate_publication_release(
  p_release_id text,
  p_approver text,
  p_activation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.publication_releases%rowtype;
  previous_release text;
  existing_request public.publication_activation_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('publication-channel:current', 0));

  select * into existing_request
  from public.publication_activation_requests
  where activation_key = p_activation_key;
  if existing_request.activation_key is not null then
    if existing_request.release_id <> p_release_id or existing_request.action <> 'activate' then
      raise exception 'ACTIVATION_KEY_CONFLICT';
    end if;
    select active_release_id into previous_release from public.publication_channels where channel = 'current';
    return jsonb_build_object('releaseId', p_release_id, 'status', 'active', 'idempotent', true, 'activeReleaseId', previous_release);
  end if;

  select * into candidate
  from public.publication_releases
  where release_id = p_release_id
  for update;
  if candidate.release_id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if candidate.status <> 'ready_for_approval' then raise exception 'RELEASE_NOT_READY_FOR_APPROVAL'; end if;
  if coalesce((candidate.validation_report->>'passed')::boolean, false) is not true then
    raise exception 'RELEASE_VALIDATION_NOT_PASSED';
  end if;

  select active_release_id into previous_release
  from public.publication_channels
  where channel = 'current'
  for update;

  if previous_release is not null and previous_release <> p_release_id then
    update public.publication_releases set status = 'superseded' where release_id = previous_release;
  end if;

  update public.publication_releases
  set status = 'active',
      supersedes_release_id = previous_release,
      approved_at = now(),
      approved_by = p_approver,
      activated_at = now(),
      deployed_at = now()
  where release_id = p_release_id;

  update public.publication_channels
  set active_release_id = p_release_id, pointer_version = pointer_version + 1, updated_at = now()
  where channel = 'current';

  insert into public.publication_activation_requests (activation_key, release_id, action, actor)
  values (p_activation_key, p_release_id, 'activate', p_approver);

  insert into public.publication_channel_events (
    channel, previous_release_id, next_release_id, action, actor, activation_key
  ) values ('current', previous_release, p_release_id, 'activate', p_approver, p_activation_key);

  update public.publication_jobs
  set status = 'activated', updated_at = now()
  where release_id = p_release_id;

  return jsonb_build_object(
    'releaseId', p_release_id,
    'status', 'active',
    'idempotent', false,
    'previousReleaseId', previous_release,
    'deployedAt', now()
  );
end;
$$;

create or replace function public.rollback_publication_release(
  p_release_id text,
  p_actor text,
  p_activation_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.publication_releases%rowtype;
  previous_release text;
  existing_request public.publication_activation_requests%rowtype;
begin
  if length(trim(p_reason)) < 12 then raise exception 'ROLLBACK_REASON_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('publication-channel:current', 0));

  select * into existing_request
  from public.publication_activation_requests
  where activation_key = p_activation_key;
  if existing_request.activation_key is not null then
    if existing_request.release_id <> p_release_id or existing_request.action <> 'rollback' then
      raise exception 'ACTIVATION_KEY_CONFLICT';
    end if;
    return jsonb_build_object('releaseId', p_release_id, 'status', 'active', 'idempotent', true);
  end if;

  select * into target from public.publication_releases where release_id = p_release_id for update;
  if target.release_id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if target.status not in ('active', 'superseded') then raise exception 'ROLLBACK_TARGET_NOT_PREVIOUSLY_ACTIVE'; end if;
  if coalesce((target.validation_report->>'passed')::boolean, false) is not true then
    raise exception 'ROLLBACK_TARGET_VALIDATION_INVALID';
  end if;

  select active_release_id into previous_release
  from public.publication_channels where channel = 'current' for update;
  if previous_release = p_release_id then
    raise exception 'ROLLBACK_TARGET_ALREADY_ACTIVE';
  end if;

  update public.publication_releases set status = 'superseded' where release_id = previous_release;
  update public.publication_releases
  set status = 'active', activated_at = now(), deployed_at = now()
  where release_id = p_release_id;
  update public.publication_channels
  set active_release_id = p_release_id, pointer_version = pointer_version + 1, updated_at = now()
  where channel = 'current';

  insert into public.publication_activation_requests (activation_key, release_id, action, actor, reason)
  values (p_activation_key, p_release_id, 'rollback', p_actor, p_reason);
  insert into public.publication_channel_events (
    channel, previous_release_id, next_release_id, action, actor, reason, activation_key
  ) values ('current', previous_release, p_release_id, 'rollback', p_actor, p_reason, p_activation_key);

  return jsonb_build_object(
    'releaseId', p_release_id,
    'status', 'active',
    'idempotent', false,
    'previousReleaseId', previous_release,
    'deployedAt', now()
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
        'contentHash', release.content_hash,
        'dataSource', release.data_source,
        'deployedAt', release.deployed_at,
        'publicationHealth', 'healthy',
        'stale', false
      )
    )
  end
  from public.publication_channels channel
  left join public.publication_releases release on release.release_id = channel.active_release_id
  where channel.channel = 'current';
$$;

revoke all on function public.acquire_publication_lease(date, text, text, integer) from public;
revoke all on function public.fail_publication_job(date, text, text) from public;
revoke all on function public.stage_publication_release(jsonb) from public;
revoke all on function public.activate_publication_release(text, text, text) from public;
revoke all on function public.rollback_publication_release(text, text, text, text) from public;
revoke all on function public.get_active_publication_release() from public;
revoke all on function public.reject_publication_release_payload_mutation() from public;

grant execute on function public.acquire_publication_lease(date, text, text, integer) to service_role;
grant execute on function public.fail_publication_job(date, text, text) to service_role;
grant execute on function public.stage_publication_release(jsonb) to service_role;
grant execute on function public.activate_publication_release(text, text, text) to service_role;
grant execute on function public.rollback_publication_release(text, text, text, text) to service_role;
grant execute on function public.get_active_publication_release() to service_role;
