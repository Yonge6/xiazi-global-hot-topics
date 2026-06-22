create or replace function public.upsert_issue_bundle(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_issue jsonb := payload->'issue';
  incoming_checksum text := payload->>'contentChecksum';
  existing_issue public.issues%rowtype;
  saved_issue_id uuid;
  next_version integer;
  changed boolean := true;
  topic_item jsonb;
  localization_item jsonb;
  source_item jsonb;
  localization_record record;
  saved_topic_id uuid;
  saved_source_id uuid;
  featured_topic_uuid uuid;
  topic_ids uuid[] := '{}';
  source_ids uuid[] := '{}';
begin
  if incoming_issue is null or incoming_checksum is null or incoming_checksum = '' then
    raise exception 'payload.issue and payload.contentChecksum are required';
  end if;

  select * into existing_issue
  from public.issues
  where slug = incoming_issue->>'slug';

  if found and exists (
    select 1
    from public.issue_revisions
    where issue_id = existing_issue.id
      and content_checksum = incoming_checksum
  ) then
    return jsonb_build_object(
      'issueId', existing_issue.id,
      'contentVersion', existing_issue.content_version,
      'changed', false
    );
  end if;

  if found then
    saved_issue_id := existing_issue.id;
    next_version := existing_issue.content_version + 1;
    update public.issues
    set
      issue_date = (incoming_issue->>'issueDate')::date,
      slot_hour = (incoming_issue->>'slotHour')::integer,
      slot_minute = coalesce((incoming_issue->>'slotMinute')::integer, 0),
      publication_timezone = coalesce(incoming_issue->>'publicationTimezone', 'Asia/Shanghai'),
      beijing_timestamp = (incoming_issue->>'beijingTimestamp')::timestamptz,
      gmt_timestamp = nullif(incoming_issue->>'gmtTimestamp', '')::timestamptz,
      status = (incoming_issue->>'status')::public.issue_status,
      asset_version = incoming_issue->>'assetVersion',
      content_version = next_version,
      published_at = case when incoming_issue->>'status' = 'published' then coalesce(existing_issue.published_at, now()) else existing_issue.published_at end
    where id = saved_issue_id;

    delete from public.topics
    where issue_id = saved_issue_id;
  else
    next_version := 1;
    insert into public.issues (
      id,
      slug,
      issue_date,
      slot_hour,
      slot_minute,
      publication_timezone,
      beijing_timestamp,
      gmt_timestamp,
      status,
      asset_version,
      content_version,
      published_at
    ) values (
      (incoming_issue->>'id')::uuid,
      incoming_issue->>'slug',
      (incoming_issue->>'issueDate')::date,
      (incoming_issue->>'slotHour')::integer,
      coalesce((incoming_issue->>'slotMinute')::integer, 0),
      coalesce(incoming_issue->>'publicationTimezone', 'Asia/Shanghai'),
      (incoming_issue->>'beijingTimestamp')::timestamptz,
      nullif(incoming_issue->>'gmtTimestamp', '')::timestamptz,
      (incoming_issue->>'status')::public.issue_status,
      incoming_issue->>'assetVersion',
      next_version,
      case when incoming_issue->>'status' = 'published' then now() else null end
    )
    returning id into saved_issue_id;
  end if;

  for topic_item in select * from jsonb_array_elements(incoming_issue->'topics')
  loop
    insert into public.topics (
      id,
      contract_id,
      issue_id,
      slug,
      rank,
      category,
      region,
      country_codes,
      event_time,
      is_developing,
      verification_status,
      score_total,
      story_id,
      story_status,
      followup_day,
      information_increment_score,
      status
    ) values (
      public.stable_uuid(saved_issue_id::text || ':' || (topic_item->>'id')),
      (topic_item->>'id')::uuid,
      saved_issue_id,
      topic_item->>'slug',
      (topic_item->>'rank')::integer,
      topic_item->>'category',
      topic_item->>'region',
      coalesce(array(select jsonb_array_elements_text(topic_item->'countryCodes')), '{}'),
      nullif(topic_item->>'eventTime', '')::timestamptz,
      coalesce((topic_item->>'isDeveloping')::boolean, false),
      (topic_item->>'verificationStatus')::public.verification_status,
      nullif(topic_item->>'scoreTotal', '')::numeric,
      topic_item->>'storyId',
      topic_item->>'storyStatus',
      nullif(topic_item->>'followupDay', '')::integer,
      nullif(topic_item->>'informationIncrementScore', '')::numeric,
      'published'
    )
    returning id into saved_topic_id;

    topic_ids := array_append(topic_ids, saved_topic_id);

    for localization_record in select * from jsonb_each(topic_item->'localizations')
    loop
      insert into public.topic_localizations (
        topic_id,
        locale,
        category_label,
        headline_fact,
        headline_view,
        headline_full,
        intro,
        xiazi_quote,
        doudou_quote,
        footer_takeaway
      ) values (
        saved_topic_id,
        localization_record.key,
        localization_record.value->>'categoryLabel',
        localization_record.value->>'headlineFact',
        localization_record.value->>'headlineView',
        localization_record.value->>'headlineFull',
        localization_record.value->>'intro',
        localization_record.value->>'xiaziQuote',
        localization_record.value->>'doudouQuote',
        localization_record.value->>'footerTakeaway'
      );
    end loop;

    for source_item in select * from jsonb_array_elements(topic_item->'sources')
    loop
      insert into public.sources (
        id,
        contract_id,
        topic_id,
        title,
        publisher,
        url,
        published_at,
        source_type,
        source_tier,
        locale,
        is_primary
      ) values (
        public.stable_uuid(saved_topic_id::text || ':' || (source_item->>'id') || ':' || (source_item->>'url')),
        (source_item->>'id')::uuid,
        saved_topic_id,
        source_item->>'title',
        source_item->>'publisher',
        source_item->>'url',
        nullif(source_item->>'publishedAt', '')::timestamptz,
        source_item->>'sourceType',
        (source_item->>'sourceTier')::integer,
        source_item->>'locale',
        coalesce((source_item->>'isPrimary')::boolean, false)
      )
      returning id into saved_source_id;
      source_ids := array_append(source_ids, saved_source_id);
    end loop;
  end loop;

  select id into featured_topic_uuid
  from public.topics
  where issue_id = saved_issue_id
    and contract_id = (incoming_issue->>'featuredTopicId')::uuid;

  update public.issues
  set featured_topic_id = featured_topic_uuid
  where id = saved_issue_id;

  insert into public.issue_revisions (
    issue_id,
    version,
    snapshot,
    content_checksum,
    change_summary,
    actor_type,
    actor_id
  ) values (
    saved_issue_id,
    next_version,
    incoming_issue,
    incoming_checksum,
    coalesce(payload->>'changeSummary', 'content import'),
    coalesce(payload->>'actorType', 'system'),
    payload->>'actorId'
  )
  on conflict (issue_id, content_checksum) do nothing;

  insert into public.audit_logs (
    action,
    entity_type,
    entity_id,
    actor_type,
    actor_id,
    after_data,
    metadata
  ) values (
    'content.import',
    'issue',
    saved_issue_id::text,
    coalesce(payload->>'actorType', 'system'),
    payload->>'actorId',
    incoming_issue,
    jsonb_build_object('checksum', incoming_checksum, 'contentVersion', next_version)
  );

  return jsonb_build_object(
    'issueId', saved_issue_id,
    'contentVersion', next_version,
    'changed', changed
  );
end;
$$;

revoke execute on function public.upsert_issue_bundle(jsonb) from public;
revoke execute on function public.upsert_issue_bundle(jsonb) from anon;
revoke execute on function public.upsert_issue_bundle(jsonb) from authenticated;
grant execute on function public.upsert_issue_bundle(jsonb) to service_role;
