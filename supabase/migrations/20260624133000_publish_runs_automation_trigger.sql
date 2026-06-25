alter table public.studio_publish_runs
  drop constraint if exists studio_publish_runs_trigger_type_check;

alter table public.studio_publish_runs
  add constraint studio_publish_runs_trigger_type_check
  check (trigger_type in ('studio', 'automation', 'retry'));

create index if not exists studio_publish_runs_trigger_type_created_at_idx
  on public.studio_publish_runs (trigger_type, created_at desc);
