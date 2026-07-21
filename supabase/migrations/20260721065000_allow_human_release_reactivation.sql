create or replace function public.activate_publication_release(
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
  if p_activation_mode = 'automatic' and candidate.status <> 'ready_for_approval' then
    raise exception 'RELEASE_NOT_READY_FOR_APPROVAL';
  end if;
  if p_activation_mode = 'human' and candidate.status not in ('ready_for_approval', 'superseded') then
    raise exception 'RELEASE_NOT_READY_FOR_APPROVAL';
  end if;
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

revoke all on function public.activate_publication_release(text, text, text, text, text, text) from public;
grant execute on function public.activate_publication_release(text, text, text, text, text, text) to service_role;
