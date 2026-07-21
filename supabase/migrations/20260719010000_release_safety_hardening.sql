alter table public.publication_releases
  add column if not exists schema_version text,
  add column if not exists release_hash text;

update public.publication_releases
set schema_version = coalesce(schema_version, 'release-v2.0'),
    release_hash = coalesce(release_hash, content_hash)
where schema_version is null or release_hash is null;

alter table public.publication_releases
  alter column schema_version set not null,
  alter column release_hash set not null,
  drop constraint if exists publication_releases_issue_content_unique,
  add constraint publication_releases_schema_version_check check (schema_version ~ '^release-v2\.[0-9]+$'),
  add constraint publication_releases_release_hash_check check (release_hash ~ '^[0-9a-f]{64}$'),
  add constraint publication_releases_issue_identity_unique unique (issue_date, release_hash);

alter table public.publication_source_snapshots
  add column if not exists claim_results jsonb not null default '[]'::jsonb,
  add constraint publication_source_claim_results_array_check check (jsonb_typeof(claim_results) = 'array');

alter table public.publication_poster_checks
  add column if not exists perceptual_hash text not null default '0000000000000000',
  add column if not exists cross_locale_theme_matches boolean not null default false,
  add column if not exists max_distinct_topic_similarity double precision not null default 1,
  add column if not exists batch_comparison_hash text not null default repeat('0', 64),
  add constraint publication_poster_perceptual_hash_check check (perceptual_hash ~ '^[0-9a-f]{16}$'),
  add constraint publication_poster_similarity_range_check check (
    max_distinct_topic_similarity >= 0 and max_distinct_topic_similarity <= 1
  ),
  add constraint publication_poster_batch_hash_check check (batch_comparison_hash ~ '^[0-9a-f]{64}$');

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
    or new.data_source is distinct from old.data_source
    or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_RELEASE_PAYLOAD';
  end if;
  return new;
end;
$$;

create or replace function public.acquire_publication_lease(
  p_issue_date date,
  p_idempotency_key text,
  p_lease_owner text,
  p_lease_seconds integer default 180
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.publication_jobs%rowtype;
begin
  if p_issue_date <= date '2026-07-18' then raise exception 'HISTORICAL_RELEASE_OUT_OF_SCOPE'; end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then raise exception 'INVALID_LEASE_DURATION'; end if;
  if length(trim(p_lease_owner)) < 3 then raise exception 'INVALID_LEASE_OWNER'; end if;

  perform pg_advisory_xact_lock(hashtextextended('publication-lease:' || p_issue_date::text, 0));
  select * into saved from public.publication_jobs where issue_date = p_issue_date for update;

  if saved.issue_date is null then
    insert into public.publication_jobs (
      issue_date, idempotency_key, lease_owner, lease_expires_at, heartbeat_at, status, updated_at
    ) values (
      p_issue_date, p_idempotency_key, p_lease_owner,
      now() + make_interval(secs => p_lease_seconds), now(), 'leased', now()
    ) returning * into saved;
    return jsonb_build_object(
      'acquired', true,
      'status', saved.status,
      'issueDate', saved.issue_date,
      'releaseId', saved.release_id,
      'leaseOwner', saved.lease_owner,
      'idempotencyKey', saved.idempotency_key,
      'leaseExpiresAt', saved.lease_expires_at
    );
  end if;

  if saved.idempotency_key = p_idempotency_key and saved.status in ('staged', 'activated') then
    return jsonb_build_object(
      'acquired', false,
      'status', saved.status,
      'issueDate', saved.issue_date,
      'releaseId', saved.release_id,
      'leaseOwner', saved.lease_owner,
      'idempotencyKey', saved.idempotency_key,
      'leaseExpiresAt', saved.lease_expires_at
    );
  end if;

  if saved.status <> 'failed' and saved.lease_expires_at > now() then
    if saved.idempotency_key = p_idempotency_key then
      return jsonb_build_object(
        'acquired', false,
        'status', saved.status,
        'issueDate', saved.issue_date,
        'releaseId', saved.release_id,
        'leaseOwner', saved.lease_owner,
        'idempotencyKey', saved.idempotency_key,
        'leaseExpiresAt', saved.lease_expires_at
      );
    end if;
    raise exception 'PUBLICATION_LEASE_HELD' using errcode = '55P03';
  end if;

  update public.publication_jobs
  set idempotency_key = p_idempotency_key,
      lease_owner = p_lease_owner,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(),
      status = 'leased',
      release_id = null,
      error_code = null,
      updated_at = now()
  where issue_date = p_issue_date
  returning * into saved;

  return jsonb_build_object(
    'acquired', true,
    'status', saved.status,
    'issueDate', saved.issue_date,
    'releaseId', saved.release_id,
    'leaseOwner', saved.lease_owner,
    'idempotencyKey', saved.idempotency_key,
    'leaseExpiresAt', saved.lease_expires_at
  );
end;
$$;

create or replace function public.renew_publication_lease(
  p_issue_date date,
  p_idempotency_key text,
  p_lease_owner text,
  p_lease_seconds integer default 180
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.publication_jobs%rowtype;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 900 then raise exception 'INVALID_LEASE_DURATION'; end if;
  perform pg_advisory_xact_lock(hashtextextended('publication-lease:' || p_issue_date::text, 0));

  update public.publication_jobs
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(),
      status = 'validating',
      updated_at = now()
  where issue_date = p_issue_date
    and idempotency_key = p_idempotency_key
    and lease_owner = p_lease_owner
    and status in ('leased', 'validating')
    and lease_expires_at > now()
  returning * into saved;

  if saved.issue_date is null then raise exception 'PUBLICATION_LEASE_EXPIRED_OR_OWNERSHIP_LOST'; end if;
  return jsonb_build_object(
    'renewed', true,
    'status', saved.status,
    'leaseOwner', saved.lease_owner,
    'leaseExpiresAt', saved.lease_expires_at,
    'heartbeatAt', saved.heartbeat_at
  );
end;
$$;

drop function if exists public.fail_publication_job(date, text, text);
create or replace function public.fail_publication_job(
  p_issue_date date,
  p_idempotency_key text,
  p_lease_owner text,
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
  where issue_date = p_issue_date
    and idempotency_key = p_idempotency_key
    and lease_owner = p_lease_owner
    and status <> 'activated';
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
  p_release_hash text := payload->>'releaseHash';
  p_schema_version text := payload->>'schemaVersion';
  p_issue_date date := (payload->>'issueDate')::date;
  p_content_hash text := payload->>'contentHash';
  p_idempotency_key text := payload->>'idempotencyKey';
  p_lease_owner text := payload->>'leaseOwner';
  p_validation jsonb := payload->'validationReport';
  source_item jsonb;
  poster_item jsonb;
  existing_source_count integer;
  existing_poster_count integer;
  saved public.publication_releases%rowtype;
  job public.publication_jobs%rowtype;
begin
  if p_issue_date <= date '2026-07-18' then raise exception 'HISTORICAL_RELEASE_OUT_OF_SCOPE'; end if;
  if p_schema_version <> 'release-v2.1' then raise exception 'RELEASE_SCHEMA_VERSION_INVALID'; end if;
  if p_release_hash !~ '^[0-9a-f]{64}$' then raise exception 'RELEASE_HASH_INVALID'; end if;
  if coalesce((p_validation->>'passed')::boolean, false) is not true then
    raise exception 'RELEASE_VALIDATION_NOT_PASSED';
  end if;
  if p_validation->>'schemaVersion' <> p_schema_version then raise exception 'VALIDATION_SCHEMA_VERSION_MISMATCH'; end if;
  if p_validation->>'sourceSnapshotHash' <> payload->>'sourceSnapshotHash'
    or p_validation->>'posterManifestHash' <> payload->>'posterManifestHash' then
    raise exception 'VALIDATION_MANIFEST_HASH_MISMATCH';
  end if;
  if jsonb_array_length(coalesce(payload->'posters', '[]'::jsonb)) <> 18 then
    raise exception 'EXPECTED_18_POSTER_CHECKS';
  end if;
  if jsonb_array_length(coalesce(payload->'sources', '[]'::jsonb)) < 8 then
    raise exception 'INSUFFICIENT_SOURCE_SNAPSHOTS';
  end if;
  if (p_validation->>'posterCount')::integer <> jsonb_array_length(payload->'posters')
    or (p_validation->>'sourceCount')::integer <> jsonb_array_length(payload->'sources') then
    raise exception 'VALIDATION_MANIFEST_COUNT_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('publication-stage:' || p_issue_date::text, 0));
  select * into job from public.publication_jobs where issue_date = p_issue_date for update;
  if job.issue_date is null
    or job.idempotency_key <> p_idempotency_key
    or job.lease_owner <> p_lease_owner then
    raise exception 'PUBLICATION_LEASE_OWNERSHIP_REQUIRED';
  end if;
  if job.status not in ('leased', 'validating') then raise exception 'PUBLICATION_LEASE_NOT_STAGEABLE'; end if;
  if job.lease_expires_at <= now() then raise exception 'PUBLICATION_LEASE_EXPIRED'; end if;

  select * into saved from public.publication_releases where release_id = p_release_id for update;
  if saved.release_id is not null then
    if saved.issue_date <> p_issue_date
      or saved.content_hash <> p_content_hash
      or saved.release_hash <> p_release_hash
      or saved.schema_version <> p_schema_version
      or saved.issue is distinct from payload->'issue'
      or saved.source_snapshot_hash <> payload->>'sourceSnapshotHash'
      or saved.poster_manifest_hash <> payload->>'posterManifestHash'
      or saved.validation_report is distinct from p_validation then
      raise exception 'RELEASE_PAYLOAD_CONFLICT';
    end if;

    select count(*) into existing_source_count
    from public.publication_source_snapshots where release_id = p_release_id;
    select count(*) into existing_poster_count
    from public.publication_poster_checks where release_id = p_release_id;
    if existing_source_count <> jsonb_array_length(payload->'sources')
      or existing_poster_count <> jsonb_array_length(payload->'posters') then
      raise exception 'RELEASE_PAYLOAD_CONFLICT';
    end if;

    for source_item in select value from jsonb_array_elements(payload->'sources') loop
      if not exists (
        select 1 from public.publication_source_snapshots source
        where source.release_id = p_release_id
          and source.source_id = source_item->>'sourceId'
          and source.topic_id = source_item->>'topicId'
          and source.url = source_item->>'url'
          and source.final_url = source_item->>'finalUrl'
          and source.fetched_at = (source_item->>'fetchedAt')::timestamptz
          and source.http_status = (source_item->>'httpStatus')::smallint
          and source.title = source_item->>'title'
          and source.content_hash = source_item->>'contentHash'
          and source.snapshot_text = source_item->>'snapshotText'
          and source.correction_status = source_item->>'correctionStatus'
          and source.supports_claim = (source_item->>'supportsClaim')::boolean
          and source.claim_results = source_item->'claimResults'
          and source.review_provider = source_item->>'reviewProvider'
          and source.review_model is not distinct from source_item->>'reviewModel'
          and source.rationale = source_item->>'rationale'
      ) then
        raise exception 'RELEASE_PAYLOAD_CONFLICT';
      end if;
    end loop;

    for poster_item in select value from jsonb_array_elements(payload->'posters') loop
      if not exists (
        select 1 from public.publication_poster_checks poster
        where poster.release_id = p_release_id
          and poster.topic_id = poster_item->>'topicId'
          and poster.locale = poster_item->>'locale'
          and poster.url = poster_item->>'url'
          and poster.content_hash = poster_item->>'contentHash'
          and poster.perceptual_hash = poster_item->>'perceptualHash'
          and poster.width = (poster_item->>'width')::integer
          and poster.height = (poster_item->>'height')::integer
          and poster.format = poster_item->>'format'
          and poster.ocr_text_hash = poster_item->>'ocrTextHash'
          and poster.detected_number = (poster_item->>'detectedNumber')::smallint
          and poster.detected_language = poster_item->>'detectedLanguage'
          and poster.title_matches = (poster_item->>'titleMatches')::boolean
          and poster.date_matches = (poster_item->>'dateMatches')::boolean
          and poster.site_matches = (poster_item->>'siteMatches')::boolean
          and poster.theme_matches = (poster_item->>'themeMatches')::boolean
          and poster.xiazi_matches = (poster_item->>'xiaziMatches')::boolean
          and poster.doudoulong_matches = (poster_item->>'doudoulongMatches')::boolean
          and poster.cross_locale_theme_matches = (poster_item->>'crossLocaleThemeMatches')::boolean
          and poster.max_distinct_topic_similarity = (poster_item->>'maxDistinctTopicSimilarity')::double precision
          and poster.batch_comparison_hash = poster_item->>'batchComparisonHash'
          and poster.duplicate_of is not distinct from poster_item->>'duplicateOf'
          and poster.review_provider = poster_item->>'reviewProvider'
          and poster.review_model is not distinct from poster_item->>'reviewModel'
          and poster.checked_at = (poster_item->>'checkedAt')::timestamptz
      ) then
        raise exception 'RELEASE_PAYLOAD_CONFLICT';
      end if;
    end loop;

    update public.publication_jobs
    set status = 'staged', release_id = p_release_id, updated_at = now()
    where issue_date = p_issue_date and idempotency_key = p_idempotency_key and lease_owner = p_lease_owner;
    return jsonb_build_object(
      'releaseId', saved.release_id,
      'issueDate', saved.issue_date,
      'contentHash', saved.content_hash,
      'status', saved.status,
      'readyAt', saved.ready_at,
      'idempotent', true
    );
  end if;

  insert into public.publication_releases (
    release_id, release_hash, schema_version, issue_date, content_hash, issue, status,
    source_snapshot_hash, poster_manifest_hash, validation_report, ready_at
  ) values (
    p_release_id, p_release_hash, p_schema_version, p_issue_date, p_content_hash, payload->'issue',
    'ready_for_approval', payload->>'sourceSnapshotHash', payload->>'posterManifestHash', p_validation, now()
  ) returning * into saved;

  for source_item in select value from jsonb_array_elements(payload->'sources') loop
    insert into public.publication_source_snapshots (
      release_id, source_id, topic_id, url, final_url, fetched_at, http_status,
      title, content_hash, snapshot_text, correction_status, supports_claim,
      claim_results, review_provider, review_model, rationale
    ) values (
      p_release_id, source_item->>'sourceId', source_item->>'topicId', source_item->>'url',
      source_item->>'finalUrl', (source_item->>'fetchedAt')::timestamptz,
      (source_item->>'httpStatus')::smallint, source_item->>'title', source_item->>'contentHash',
      source_item->>'snapshotText', source_item->>'correctionStatus',
      (source_item->>'supportsClaim')::boolean, source_item->'claimResults',
      source_item->>'reviewProvider', source_item->>'reviewModel', source_item->>'rationale'
    );
  end loop;

  for poster_item in select value from jsonb_array_elements(payload->'posters') loop
    insert into public.publication_poster_checks (
      release_id, topic_id, locale, url, content_hash, perceptual_hash, width, height, format,
      ocr_text_hash, detected_number, detected_language, title_matches, date_matches, site_matches,
      theme_matches, xiazi_matches, doudoulong_matches, cross_locale_theme_matches,
      max_distinct_topic_similarity, batch_comparison_hash, duplicate_of,
      review_provider, review_model, checked_at
    ) values (
      p_release_id, poster_item->>'topicId', poster_item->>'locale', poster_item->>'url',
      poster_item->>'contentHash', poster_item->>'perceptualHash',
      (poster_item->>'width')::integer, (poster_item->>'height')::integer, poster_item->>'format',
      poster_item->>'ocrTextHash', (poster_item->>'detectedNumber')::smallint,
      poster_item->>'detectedLanguage', (poster_item->>'titleMatches')::boolean,
      (poster_item->>'dateMatches')::boolean, (poster_item->>'siteMatches')::boolean,
      (poster_item->>'themeMatches')::boolean, (poster_item->>'xiaziMatches')::boolean,
      (poster_item->>'doudoulongMatches')::boolean, (poster_item->>'crossLocaleThemeMatches')::boolean,
      (poster_item->>'maxDistinctTopicSimilarity')::double precision,
      poster_item->>'batchComparisonHash', poster_item->>'duplicateOf',
      poster_item->>'reviewProvider', poster_item->>'reviewModel',
      (poster_item->>'checkedAt')::timestamptz
    );
  end loop;

  update public.publication_jobs
  set status = 'staged', release_id = p_release_id, updated_at = now()
  where issue_date = p_issue_date and idempotency_key = p_idempotency_key and lease_owner = p_lease_owner;

  return jsonb_build_object(
    'releaseId', saved.release_id,
    'issueDate', saved.issue_date,
    'contentHash', saved.content_hash,
    'status', saved.status,
    'readyAt', saved.ready_at,
    'idempotent', false
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
  current_release text;
  existing_request public.publication_activation_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('publication-channel:current', 0));
  select * into existing_request from public.publication_activation_requests where activation_key = p_activation_key;
  if existing_request.activation_key is not null then
    if existing_request.release_id <> p_release_id or existing_request.action <> 'activate' then
      raise exception 'ACTIVATION_KEY_CONFLICT';
    end if;
    select active_release_id into current_release from public.publication_channels where channel = 'current';
    return jsonb_build_object(
      'idempotent', true,
      'requestedReleaseId', p_release_id,
      'currentActiveReleaseId', current_release,
      'requestPreviouslyCompleted', true
    );
  end if;

  select * into candidate from public.publication_releases where release_id = p_release_id for update;
  if candidate.release_id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if candidate.status <> 'ready_for_approval' then raise exception 'RELEASE_NOT_READY_FOR_APPROVAL'; end if;
  if coalesce((candidate.validation_report->>'passed')::boolean, false) is not true then
    raise exception 'RELEASE_VALIDATION_NOT_PASSED';
  end if;

  select active_release_id into previous_release
  from public.publication_channels where channel = 'current' for update;
  if previous_release is not null and previous_release <> p_release_id then
    update public.publication_releases set status = 'superseded' where release_id = previous_release;
  end if;
  update public.publication_releases
  set status = 'active', supersedes_release_id = previous_release, approved_at = now(),
      approved_by = p_approver, activated_at = now(), deployed_at = now()
  where release_id = p_release_id;
  update public.publication_channels
  set active_release_id = p_release_id, pointer_version = pointer_version + 1, updated_at = now()
  where channel = 'current';
  insert into public.publication_activation_requests (activation_key, release_id, action, actor)
  values (p_activation_key, p_release_id, 'activate', p_approver);
  insert into public.publication_channel_events (
    channel, previous_release_id, next_release_id, action, actor, activation_key
  ) values ('current', previous_release, p_release_id, 'activate', p_approver, p_activation_key);
  update public.publication_jobs set status = 'activated', updated_at = now() where release_id = p_release_id;

  return jsonb_build_object(
    'idempotent', false,
    'requestedReleaseId', p_release_id,
    'currentActiveReleaseId', p_release_id,
    'previousReleaseId', previous_release,
    'requestPreviouslyCompleted', false,
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
  current_release text;
  existing_request public.publication_activation_requests%rowtype;
begin
  if length(trim(p_reason)) < 12 then raise exception 'ROLLBACK_REASON_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('publication-channel:current', 0));
  select * into existing_request from public.publication_activation_requests where activation_key = p_activation_key;
  if existing_request.activation_key is not null then
    if existing_request.release_id <> p_release_id or existing_request.action <> 'rollback' then
      raise exception 'ACTIVATION_KEY_CONFLICT';
    end if;
    select active_release_id into current_release from public.publication_channels where channel = 'current';
    return jsonb_build_object(
      'idempotent', true,
      'requestedReleaseId', p_release_id,
      'currentActiveReleaseId', current_release,
      'requestPreviouslyCompleted', true
    );
  end if;

  select * into target from public.publication_releases where release_id = p_release_id for update;
  if target.release_id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if target.status not in ('active', 'superseded') then raise exception 'ROLLBACK_TARGET_NOT_PREVIOUSLY_ACTIVE'; end if;
  if coalesce((target.validation_report->>'passed')::boolean, false) is not true then
    raise exception 'ROLLBACK_TARGET_VALIDATION_INVALID';
  end if;

  select active_release_id into previous_release
  from public.publication_channels where channel = 'current' for update;
  if previous_release = p_release_id then raise exception 'ROLLBACK_TARGET_ALREADY_ACTIVE'; end if;
  update public.publication_releases set status = 'superseded' where release_id = previous_release;
  update public.publication_releases set status = 'active', activated_at = now(), deployed_at = now()
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
    'idempotent', false,
    'requestedReleaseId', p_release_id,
    'currentActiveReleaseId', p_release_id,
    'previousReleaseId', previous_release,
    'requestPreviouslyCompleted', false,
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
        'releaseSchemaVersion', release.schema_version,
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

revoke all on function public.renew_publication_lease(date, text, text, integer) from public;
revoke all on function public.fail_publication_job(date, text, text, text) from public;
grant execute on function public.renew_publication_lease(date, text, text, integer) to service_role;
grant execute on function public.fail_publication_job(date, text, text, text) to service_role;
