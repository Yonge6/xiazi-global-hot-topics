\set ON_ERROR_STOP on

begin;

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

select public.acquire_publication_lease(date '2026-07-21', 'lease-a', 'sql-test-a', 300);
do $$
begin
  begin
    perform public.acquire_publication_lease(date '2026-07-21', 'lease-b', 'sql-test-b', 300);
    raise exception 'concurrent lease did not reject';
  exception when lock_not_available then
    null;
  end;
end;
$$;

do $$
declare
  sources jsonb;
  posters jsonb;
  result jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'sourceId', 'source-a-' || value,
    'topicId', 'topic-' || value,
    'url', 'https://example.com/source-a-' || value,
    'finalUrl', 'https://example.com/source-a-' || value,
    'fetchedAt', '2026-07-19T04:50:00+08:00',
    'httpStatus', 200,
    'title', 'Source A ' || value,
    'contentHash', repeat(lpad(value::text, 2, '0'), 32),
    'snapshotText', 'Snapshot supporting the publication claim ' || value,
    'correctionStatus', 'clear',
    'supportsClaim', true,
    'reviewProvider', 'sql-fault-test',
    'rationale', 'Claim supported and no correction detected.'
  )) into sources from generate_series(1, 8) value;

  select jsonb_agg(jsonb_build_object(
    'topicId', 'topic-' || (((value - 1) / 2) + 1),
    'locale', case when value % 2 = 1 then 'zh' else 'en' end,
    'url', 'https://assets.example.com/releases/rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa/poster-' || value || '.png',
    'contentHash', repeat(lpad(value::text, 2, '0'), 32),
    'width', 1080,
    'height', 2160,
    'format', 'png',
    'ocrTextHash', repeat(lpad((value + 20)::text, 2, '0'), 32),
    'detectedNumber', (((value - 1) / 2) + 1),
    'detectedLanguage', case when value % 2 = 1 then 'zh' else 'en' end,
    'titleMatches', true,
    'dateMatches', true,
    'siteMatches', true,
    'themeMatches', true,
    'xiaziMatches', true,
    'doudoulongMatches', true,
    'duplicateOf', null,
    'reviewProvider', 'sql-fault-test',
    'checkedAt', '2026-07-19T04:55:00+08:00'
  )) into posters from generate_series(1, 18) value;

  perform public.acquire_publication_lease(date '2026-07-19', 'release-a-stage', 'sql-test', 300);
  result := public.stage_publication_release(jsonb_build_object(
    'releaseId', 'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa',
    'issueDate', '2026-07-19',
    'contentHash', repeat('a', 64),
    'idempotencyKey', 'release-a-stage',
    'issue', jsonb_build_object('issueDate', '2026-07-19', 'slug', 'daily-2026-07-19', 'status', 'published'),
    'sources', sources,
    'posters', posters,
    'sourceSnapshotHash', repeat('c', 64),
    'posterManifestHash', repeat('d', 64),
    'validationReport', jsonb_build_object('passed', true, 'checkedAt', now())
  ));
  if result->>'status' <> 'ready_for_approval' then raise exception 'release A was not staged'; end if;

  result := public.activate_publication_release(
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', 'human@example.com', 'activate-a'
  );
  if result->>'status' <> 'active' then raise exception 'release A was not activated'; end if;
  result := public.activate_publication_release(
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa', 'human@example.com', 'activate-a'
  );
  if (result->>'idempotent')::boolean is not true then raise exception 'activation was not idempotent'; end if;
end;
$$;

do $$
declare
  sources jsonb;
  posters jsonb;
  result jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'sourceId', 'source-b-' || value,
    'topicId', 'topic-' || value,
    'url', 'https://example.com/source-b-' || value,
    'finalUrl', 'https://example.com/source-b-' || value,
    'fetchedAt', '2026-07-20T04:50:00+08:00',
    'httpStatus', 200,
    'title', 'Source B ' || value,
    'contentHash', repeat(lpad((value + 30)::text, 2, '0'), 32),
    'snapshotText', 'Snapshot supporting the replacement publication claim ' || value,
    'correctionStatus', 'clear',
    'supportsClaim', true,
    'reviewProvider', 'sql-fault-test',
    'rationale', 'Claim supported and no correction detected.'
  )) into sources from generate_series(1, 8) value;

  select jsonb_agg(jsonb_build_object(
    'topicId', 'topic-' || (((value - 1) / 2) + 1),
    'locale', case when value % 2 = 1 then 'zh' else 'en' end,
    'url', 'https://assets.example.com/releases/rel_20260720_bbbbbbbbbbbbbbbbbbbbbbbb/poster-' || value || '.png',
    'contentHash', repeat(lpad((value + 40)::text, 2, '0'), 32),
    'width', 1080,
    'height', 2160,
    'format', 'png',
    'ocrTextHash', repeat(lpad((value + 60)::text, 2, '0'), 32),
    'detectedNumber', (((value - 1) / 2) + 1),
    'detectedLanguage', case when value % 2 = 1 then 'zh' else 'en' end,
    'titleMatches', true,
    'dateMatches', true,
    'siteMatches', true,
    'themeMatches', true,
    'xiaziMatches', true,
    'doudoulongMatches', true,
    'duplicateOf', null,
    'reviewProvider', 'sql-fault-test',
    'checkedAt', '2026-07-20T04:55:00+08:00'
  )) into posters from generate_series(1, 18) value;

  perform public.acquire_publication_lease(date '2026-07-20', 'release-b-stage', 'sql-test', 300);
  perform public.stage_publication_release(jsonb_build_object(
    'releaseId', 'rel_20260720_bbbbbbbbbbbbbbbbbbbbbbbb',
    'issueDate', '2026-07-20',
    'contentHash', repeat('b', 64),
    'idempotencyKey', 'release-b-stage',
    'issue', jsonb_build_object('issueDate', '2026-07-20', 'slug', 'daily-2026-07-20', 'status', 'published'),
    'sources', sources,
    'posters', posters,
    'sourceSnapshotHash', repeat('e', 64),
    'posterManifestHash', repeat('f', 64),
    'validationReport', jsonb_build_object('passed', true, 'checkedAt', now())
  ));
  perform public.activate_publication_release(
    'rel_20260720_bbbbbbbbbbbbbbbbbbbbbbbb', 'human@example.com', 'activate-b'
  );
  result := public.rollback_publication_release(
    'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa',
    'human@example.com',
    'rollback-to-a',
    'Fault injection rollback verification'
  );
  if result->>'status' <> 'active' then raise exception 'rollback target was not activated'; end if;
end;
$$;

do $$
declare
  active_id text;
  event_count integer;
begin
  select active_release_id into active_id from public.publication_channels where channel = 'current';
  if active_id <> 'rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa' then
    raise exception 'atomic pointer did not roll back to release A';
  end if;
  select count(*) into event_count from public.publication_channel_events;
  if event_count <> 3 then raise exception 'expected 3 channel events, found %', event_count; end if;

  begin
    update public.publication_releases
      set issue = jsonb_build_object('tampered', true)
      where release_id = active_id;
    raise exception 'immutable release payload accepted an update';
  exception when others then
    if sqlerrm <> 'IMMUTABLE_RELEASE_PAYLOAD' then raise; end if;
  end;
end;
$$;

rollback;

\echo 'future release RPC verification passed: cutoff, lease conflict, staging, manual activation, idempotency, atomic pointer, immutability, rollback'
