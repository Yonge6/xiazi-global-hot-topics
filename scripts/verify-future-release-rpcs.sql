\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.make_release_payload(
  p_issue_date date,
  p_release_id text,
  p_release_hash text,
  p_source_hash text,
  p_poster_hash text,
  p_idempotency_key text,
  p_lease_owner text,
  p_seed integer
)
returns jsonb
language plpgsql
as $$
declare
  sources jsonb;
  posters jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'sourceId', 'source-' || p_seed || '-' || value,
    'topicId', 'topic-' || value,
    'url', 'https://example.com/source-' || p_seed || '-' || value,
    'finalUrl', 'https://example.com/source-' || p_seed || '-' || value,
    'fetchedAt', p_issue_date::text || 'T04:50:00+08:00',
    'httpStatus', 200,
    'title', 'Source ' || value,
    'contentHash', encode(digest(p_release_id || ':source:' || value, 'sha256'), 'hex'),
    'snapshotText', 'Snapshot supporting every headline and introduction claim ' || value,
    'correctionStatus', 'clear',
    'supportsClaim', true,
    'claimResults', jsonb_build_array(
      jsonb_build_object('field', 'headlineFact', 'locale', 'zh-CN', 'text', '中文事实', 'status', 'supported', 'rationale', 'supported'),
      jsonb_build_object('field', 'intro', 'locale', 'zh-CN', 'text', '中文正文事实', 'status', 'supported', 'rationale', 'supported'),
      jsonb_build_object('field', 'headlineFact', 'locale', 'en-US', 'text', 'English fact', 'status', 'supported', 'rationale', 'supported'),
      jsonb_build_object('field', 'intro', 'locale', 'en-US', 'text', 'English introduction fact', 'status', 'supported', 'rationale', 'supported')
    ),
    'reviewProvider', 'sql-fault-test',
    'rationale', 'Every factual claim is supported and no correction was detected.'
  )) into sources from generate_series(1, 8) value;

  select jsonb_agg(jsonb_build_object(
    'topicId', 'topic-' || (((value - 1) / 2) + 1),
    'locale', case when value % 2 = 1 then 'zh' else 'en' end,
    'url', 'https://assets.example.com/release-assets/asset-sql-' || p_seed || '/poster-' || value || '.png',
    'contentHash', encode(digest(p_release_id || ':poster:' || value, 'sha256'), 'hex'),
    'perceptualHash', substr(encode(digest(p_release_id || ':phash:' || value, 'sha256'), 'hex'), 1, 16),
    'width', 1080,
    'height', 2160,
    'format', 'png',
    'ocrTextHash', encode(digest(p_release_id || ':ocr:' || value, 'sha256'), 'hex'),
    'detectedNumber', (((value - 1) / 2) + 1),
    'detectedLanguage', case when value % 2 = 1 then 'zh' else 'en' end,
    'titleMatches', true,
    'dateMatches', true,
    'siteMatches', true,
    'themeMatches', true,
    'xiaziMatches', true,
    'doudoulongMatches', true,
    'crossLocaleThemeMatches', true,
    'maxDistinctTopicSimilarity', 0.2,
    'batchComparisonHash', encode(digest(p_release_id || ':batch', 'sha256'), 'hex'),
    'duplicateOf', null,
    'reviewProvider', 'sql-fault-test',
    'checkedAt', p_issue_date::text || 'T04:55:00+08:00'
  )) into posters from generate_series(1, 18) value;

  return jsonb_build_object(
    'releaseId', p_release_id,
    'releaseHash', p_release_hash,
    'schemaVersion', 'release-v2.1',
    'issueDate', p_issue_date,
    'contentHash', repeat('a', 64),
    'idempotencyKey', p_idempotency_key,
    'leaseOwner', p_lease_owner,
    'issue', jsonb_build_object('issueDate', p_issue_date, 'slug', 'daily-' || p_issue_date, 'status', 'published'),
    'sources', sources,
    'posters', posters,
    'sourceSnapshotHash', p_source_hash,
    'posterManifestHash', p_poster_hash,
    'validationReport', jsonb_build_object(
      'passed', true,
      'schemaVersion', 'release-v2.1',
      'checkedAt', now(),
      'sourceSnapshotHash', p_source_hash,
      'posterManifestHash', p_poster_hash,
      'sourceCount', 8,
      'posterCount', 18,
      'failures', jsonb_build_array()
    )
  );
end;
$$;

do $$
begin
  begin
    perform public.acquire_publication_lease(date '2026-07-18', 'historical-key', 'sql-test', 300);
    raise exception 'historical cutoff did not reject';
  exception when others then
    if sqlerrm <> 'HISTORICAL_RELEASE_OUT_OF_SCOPE' then raise; end if;
  end;
end;
$$;

do $$
declare
  first_result jsonb;
  retry_result jsonb;
begin
  first_result := public.acquire_publication_lease(date '2026-07-23', 'same-idempotency', 'owner-original', 300);
  retry_result := public.acquire_publication_lease(date '2026-07-23', 'same-idempotency', 'owner-retry', 300);
  if (first_result->>'acquired')::boolean is not true then raise exception 'initial lease not acquired'; end if;
  if (retry_result->>'acquired')::boolean is not false then raise exception 'active retry acquired duplicate lease'; end if;
  if retry_result->>'leaseOwner' <> 'owner-original' then raise exception 'active retry replaced owner'; end if;
  begin
    perform public.acquire_publication_lease(date '2026-07-23', 'different-idempotency', 'owner-other', 300);
    raise exception 'conflicting lease did not reject';
  exception when lock_not_available then
    null;
  end;
end;
$$;

do $$
declare
  before_expiry timestamptz;
  after_expiry timestamptz;
begin
  perform public.acquire_publication_lease(date '2026-07-22', 'heartbeat-key', 'heartbeat-owner', 60);
  update public.publication_jobs
  set lease_expires_at = now() + interval '30 seconds'
  where issue_date = date '2026-07-22';
  select lease_expires_at into before_expiry from public.publication_jobs where issue_date = date '2026-07-22';
  perform public.renew_publication_lease(date '2026-07-22', 'heartbeat-key', 'heartbeat-owner', 300);
  select lease_expires_at into after_expiry from public.publication_jobs where issue_date = date '2026-07-22';
  if after_expiry <= before_expiry then raise exception 'heartbeat did not extend lease'; end if;
end;
$$;

do $$
begin
  perform public.acquire_publication_lease(date '2026-07-21', 'expired-worker', 'old-owner', 60);
  update public.publication_jobs set lease_expires_at = now() - interval '1 second'
  where issue_date = date '2026-07-21';
  begin
    perform public.stage_publication_release(pg_temp.make_release_payload(
      date '2026-07-21',
      'rel_20260721_cccccccccccccccccccccccc', repeat('c', 64), repeat('d', 64), repeat('e', 64),
      'expired-worker', 'old-owner', 21
    ));
    raise exception 'expired worker staged a release';
  exception when others then
    if sqlerrm <> 'PUBLICATION_LEASE_EXPIRED' then raise; end if;
  end;

  perform public.acquire_publication_lease(date '2026-07-21', 'replacement-worker', 'new-owner', 300);
  perform public.renew_publication_lease(date '2026-07-21', 'replacement-worker', 'new-owner', 300);
  begin
    perform public.stage_publication_release(pg_temp.make_release_payload(
      date '2026-07-21',
      'rel_20260721_cccccccccccccccccccccccc', repeat('c', 64), repeat('d', 64), repeat('e', 64),
      'expired-worker', 'old-owner', 21
    ));
    raise exception 'old owner staged after lease takeover';
  exception when others then
    if sqlerrm <> 'PUBLICATION_LEASE_OWNERSHIP_REQUIRED' then raise; end if;
  end;
end;
$$;

do $$
declare
  result jsonb;
begin
  perform public.acquire_publication_lease(date '2026-07-19', 'release-a-stage', 'owner-a', 300);
  perform public.renew_publication_lease(date '2026-07-19', 'release-a-stage', 'owner-a', 300);
  result := public.stage_publication_release(pg_temp.make_release_payload(
    date '2026-07-19',
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', repeat('a', 64), repeat('c', 64), repeat('d', 64),
    'release-a-stage', 'owner-a', 1
  ));
  if result->>'status' <> 'ready_for_approval' then raise exception 'release A was not staged'; end if;

  update public.publication_jobs
  set status = 'validating', lease_expires_at = now() + interval '5 minutes'
  where issue_date = date '2026-07-19';
  begin
    perform public.stage_publication_release(pg_temp.make_release_payload(
      date '2026-07-19',
      'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', repeat('a', 64), repeat('c', 64), repeat('f', 64),
      'release-a-stage', 'owner-a', 2
    ));
    raise exception 'conflicting release payload was silently reused';
  exception when others then
    if sqlerrm <> 'RELEASE_PAYLOAD_CONFLICT' then raise; end if;
  end;

  begin
    perform public.stage_publication_release(pg_temp.make_release_payload(
      date '2026-07-19',
      'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', repeat('a', 64), repeat('c', 64), repeat('d', 64),
      'release-a-stage', 'owner-a', 99
    ));
    raise exception 'changed child payload was silently reused under unchanged manifest hashes';
  exception when others then
    if sqlerrm <> 'RELEASE_PAYLOAD_CONFLICT' then raise; end if;
  end;

  result := public.activate_publication_release(
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', 'human@example.com', 'activate-a'
  );
  if result->>'currentActiveReleaseId' <> 'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa' then
    raise exception 'release A was not activated';
  end if;
  result := public.activate_publication_release(
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', 'human@example.com', 'activate-a'
  );
  if (result->>'idempotent')::boolean is not true
    or result->>'currentActiveReleaseId' <> 'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa' then
    raise exception 'activation idempotency response was inaccurate';
  end if;
end;
$$;

do $$
declare
  result jsonb;
  release_count integer;
begin
  update public.publication_jobs set lease_expires_at = now() - interval '1 second'
  where issue_date = date '2026-07-19';
  perform public.acquire_publication_lease(date '2026-07-19', 'release-b-stage', 'owner-b', 300);
  perform public.renew_publication_lease(date '2026-07-19', 'release-b-stage', 'owner-b', 300);
  perform public.stage_publication_release(pg_temp.make_release_payload(
    date '2026-07-19',
    'rel_20260719_bbbbbbbbbbbbbbbbbbbbbbbb', repeat('b', 64), repeat('e', 64), repeat('f', 64),
    'release-b-stage', 'owner-b', 2
  ));
  select count(*) into release_count
  from public.publication_releases
  where issue_date = date '2026-07-19' and content_hash = repeat('a', 64);
  if release_count <> 2 then raise exception 'poster/source-only release identity was not preserved'; end if;

  perform public.activate_publication_release(
    'rel_20260719_bbbbbbbbbbbbbbbbbbbbbbbb', 'human@example.com', 'activate-b'
  );
  result := public.activate_publication_release(
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', 'human@example.com', 'activate-a'
  );
  if result->>'currentActiveReleaseId' <> 'rel_20260719_bbbbbbbbbbbbbbbbbbbbbbbb'
    or result ? 'status' then
    raise exception 'old activation retry falsely claimed active status';
  end if;

  perform public.rollback_publication_release(
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', 'human@example.com', 'rollback-to-a',
    'Fault injection rollback verification to release A'
  );
  perform public.rollback_publication_release(
    'rel_20260719_bbbbbbbbbbbbbbbbbbbbbbbb', 'human@example.com', 'rollback-to-b',
    'Fault injection pointer change after first rollback'
  );
  result := public.rollback_publication_release(
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', 'human@example.com', 'rollback-to-a',
    'Fault injection rollback verification to release A'
  );
  if result->>'currentActiveReleaseId' <> 'rel_20260719_bbbbbbbbbbbbbbbbbbbbbbbb'
    or result ? 'status' then
    raise exception 'old rollback retry falsely claimed active status';
  end if;
end;
$$;

do $$
declare
  active_id text;
  event_count integer;
begin
  select active_release_id into active_id from public.publication_channels where channel = 'current';
  if active_id <> 'rel_20260719_bbbbbbbbbbbbbbbbbbbbbbbb' then
    raise exception 'final atomic pointer does not match release B';
  end if;
  select count(*) into event_count from public.publication_channel_events;
  if event_count <> 4 then raise exception 'expected 4 channel events, found %', event_count; end if;

  begin
    update public.publication_releases
    set issue = jsonb_build_object('tampered', true)
    where release_id = 'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa';
    raise exception 'immutable release payload accepted an update';
  exception when others then
    if sqlerrm <> 'IMMUTABLE_RELEASE_PAYLOAD' then raise; end if;
  end;
end;
$$;

rollback;

\echo 'future release RPC verification passed: complete identity, owner lease, heartbeat, expired-worker rejection, payload conflict, activation truth, atomic rollback'
