create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.issues
  drop constraint if exists issues_slot_hour_check;

alter table public.issues
  add constraint issues_slot_hour_check check (slot_hour between 0 and 23);

alter table public.issues
  add column if not exists slot_minute smallint not null default 0,
  add column if not exists publication_timezone text not null default 'Asia/Shanghai',
  add column if not exists gmt_timestamp timestamptz,
  add column if not exists asset_version text,
  add column if not exists content_version integer not null default 1,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.issues
  drop constraint if exists issues_issue_date_slot_hour_key,
  drop constraint if exists issues_issue_date_slot_hour_slot_minute_key,
  drop constraint if exists issues_slot_minute_check,
  drop constraint if exists issues_content_version_check;

alter table public.issues
  add constraint issues_slot_minute_check check (slot_minute between 0 and 59),
  add constraint issues_content_version_check check (content_version >= 1),
  add constraint issues_issue_date_slot_hour_slot_minute_key unique (issue_date, slot_hour, slot_minute);

alter table public.topics
  add column if not exists story_id text,
  add column if not exists story_status text,
  add column if not exists followup_day integer,
  add column if not exists information_increment_score numeric(5,2);

alter table public.topics
  drop constraint if exists topics_story_status_check,
  drop constraint if exists topics_followup_day_check,
  drop constraint if exists topics_information_increment_score_check;

alter table public.topics
  add constraint topics_story_status_check check (story_status is null or story_status in ('new', 'followup', 'finished')),
  add constraint topics_followup_day_check check (followup_day is null or followup_day >= 1),
  add constraint topics_information_increment_score_check check (
    information_increment_score is null or information_increment_score between 0 and 100
  );

alter table public.topic_localizations
  add column if not exists category_label text,
  add column if not exists headline_fact text,
  add column if not exists headline_view text,
  add column if not exists headline_full text,
  add column if not exists intro text,
  add column if not exists xiazi_quote text,
  add column if not exists doudou_quote text,
  add column if not exists footer_takeaway text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.sources
  add column if not exists updated_at timestamptz not null default now();

alter table public.sources
  drop constraint if exists sources_source_type_check,
  drop constraint if exists sources_source_tier_check,
  drop constraint if exists sources_locale_check,
  drop constraint if exists sources_url_check;

alter table public.sources
  add constraint sources_source_type_check check (source_type in ('official', 'wire', 'publisher', 'research')),
  add constraint sources_source_tier_check check (source_tier between 1 and 3),
  add constraint sources_locale_check check (locale in ('zh-CN', 'en-US'));

alter table public.poster_assets
  add column if not exists public_url text,
  add column if not exists bytes bigint,
  add column if not exists mime_type text,
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists is_current boolean not null default true;

create index if not exists poster_assets_topic_asset_locale_idx
  on public.poster_assets(topic_id, asset_type, locale);

create unique index if not exists poster_assets_current_unique_idx
  on public.poster_assets(topic_id, asset_type, locale)
  where is_current = true;

create table if not exists public.issue_revisions (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  content_checksum text not null,
  change_summary text,
  actor_type text,
  actor_id text,
  created_at timestamptz not null default now(),
  unique(issue_id, version),
  unique(issue_id, content_checksum)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text,
  actor_type text,
  actor_id text,
  request_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.issue_revisions enable row level security;
alter table public.audit_logs enable row level security;

drop trigger if exists set_issues_updated_at on public.issues;
create trigger set_issues_updated_at
  before update on public.issues
  for each row execute function public.set_updated_at();

drop trigger if exists set_topics_updated_at on public.topics;
create trigger set_topics_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

drop trigger if exists set_topic_localizations_updated_at on public.topic_localizations;
create trigger set_topic_localizations_updated_at
  before update on public.topic_localizations
  for each row execute function public.set_updated_at();

drop trigger if exists set_sources_updated_at on public.sources;
create trigger set_sources_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

drop trigger if exists set_poster_assets_updated_at on public.poster_assets;
create trigger set_poster_assets_updated_at
  before update on public.poster_assets
  for each row execute function public.set_updated_at();

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
    on conflict (issue_id, slug) do update
      set
        rank = excluded.rank,
        category = excluded.category,
        region = excluded.region,
        country_codes = excluded.country_codes,
        event_time = excluded.event_time,
        is_developing = excluded.is_developing,
        verification_status = excluded.verification_status,
        score_total = excluded.score_total,
        story_id = excluded.story_id,
        story_status = excluded.story_status,
        followup_day = excluded.followup_day,
        information_increment_score = excluded.information_increment_score,
        status = excluded.status
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
      )
      on conflict (topic_id, locale) do update
        set
          category_label = excluded.category_label,
          headline_fact = excluded.headline_fact,
          headline_view = excluded.headline_view,
          headline_full = excluded.headline_full,
          intro = excluded.intro,
          xiazi_quote = excluded.xiazi_quote,
          doudou_quote = excluded.doudou_quote,
          footer_takeaway = excluded.footer_takeaway;
    end loop;

    for source_item in select * from jsonb_array_elements(topic_item->'sources')
    loop
      insert into public.sources (
        id,
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
      on conflict (id) do update
        set
          topic_id = excluded.topic_id,
          title = excluded.title,
          publisher = excluded.publisher,
          url = excluded.url,
          published_at = excluded.published_at,
          source_type = excluded.source_type,
          source_tier = excluded.source_tier,
          locale = excluded.locale,
          is_primary = excluded.is_primary
      returning id into saved_source_id;
      source_ids := array_append(source_ids, saved_source_id);
    end loop;
  end loop;

  select id into featured_topic_uuid
  from public.topics
  where issue_id = saved_issue_id
    and id = (incoming_issue->>'featuredTopicId')::uuid;

  update public.issues
  set featured_topic_id = featured_topic_uuid
  where id = saved_issue_id;

  delete from public.sources
  where topic_id = any(topic_ids)
    and not (id = any(source_ids));

  delete from public.topic_localizations
  where topic_id = any(topic_ids)
    and locale not in ('zh-CN', 'en-US');

  delete from public.topics
  where issue_id = saved_issue_id
    and not (id = any(topic_ids));

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
