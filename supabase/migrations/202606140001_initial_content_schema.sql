create extension if not exists "pgcrypto";

create type public.issue_status as enum (
  'draft', 'researching', 'selecting', 'writing', 'review',
  'generating_art', 'typesetting', 'qa', 'ready', 'published', 'failed'
);
create type public.verification_status as enum ('pending', 'verified', 'disputed', 'retracted');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.poster_asset_type as enum ('art_base', 'poster_zh', 'poster_en', 'thumbnail', 'source_svg');

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  issue_date date not null,
  slot_hour integer not null check (slot_hour in (0, 6, 12, 18)),
  beijing_timestamp timestamptz not null,
  status public.issue_status not null default 'draft',
  featured_topic_id uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issue_date, slot_hour)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  slug text not null,
  rank integer not null check (rank between 1 and 9),
  category text not null,
  region text,
  country_codes text[] not null default '{}',
  event_time timestamptz,
  is_developing boolean not null default false,
  verification_status public.verification_status not null default 'pending',
  score_total numeric(5,2),
  score_breakdown jsonb not null default '{}'::jsonb,
  visual_brief jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issue_id, slug),
  unique (issue_id, rank)
);

alter table public.issues
  add constraint issues_featured_topic_id_fkey
  foreign key (featured_topic_id) references public.topics(id) on delete set null;

create table public.topic_localizations (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  locale text not null check (locale in ('zh-CN', 'en-US')),
  category_label text,
  headline_fact text not null,
  headline_view text not null,
  headline_full text not null,
  intro text not null,
  xiazi_quote text not null,
  doudou_quote text not null,
  footer_takeaway text not null,
  seo_title text,
  seo_description text,
  unique (topic_id, locale)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null,
  publisher text not null,
  url text not null check (url ~ '^https://'),
  published_at timestamptz,
  source_type text,
  source_tier integer check (source_tier between 1 and 3),
  locale text,
  is_primary boolean not null default false,
  retrieved_at timestamptz not null default now()
);

create table public.poster_assets (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  asset_type public.poster_asset_type not null,
  locale text check (locale is null or locale in ('zh-CN', 'en-US')),
  storage_path text not null,
  width integer,
  height integer,
  format text,
  model text,
  quality text,
  prompt_version text,
  prompt_snapshot jsonb,
  checksum text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  job_type text not null,
  status public.job_status not null default 'queued',
  idempotency_key text unique not null,
  attempt integer not null default 0,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index topics_issue_id_idx on public.topics(issue_id);
create index sources_topic_id_idx on public.sources(topic_id);
create index poster_assets_topic_id_idx on public.poster_assets(topic_id);
create index jobs_status_created_at_idx on public.jobs(status, created_at);

alter table public.issues enable row level security;
alter table public.topics enable row level security;
alter table public.topic_localizations enable row level security;
alter table public.sources enable row level security;
alter table public.poster_assets enable row level security;
alter table public.jobs enable row level security;

create policy "published issues are public"
  on public.issues for select using (status = 'published');
create policy "topics in published issues are public"
  on public.topics for select using (
    exists (select 1 from public.issues where issues.id = topics.issue_id and issues.status = 'published')
  );
create policy "localizations in published issues are public"
  on public.topic_localizations for select using (
    exists (
      select 1 from public.topics
      join public.issues on issues.id = topics.issue_id
      where topics.id = topic_localizations.topic_id and issues.status = 'published'
    )
  );
create policy "sources in published issues are public"
  on public.sources for select using (
    exists (
      select 1 from public.topics
      join public.issues on issues.id = topics.issue_id
      where topics.id = sources.topic_id and issues.status = 'published'
    )
  );
create policy "ready poster assets in published issues are public"
  on public.poster_assets for select using (
    status = 'ready' and exists (
      select 1 from public.topics
      join public.issues on issues.id = topics.issue_id
      where topics.id = poster_assets.topic_id and issues.status = 'published'
    )
  );
