alter table public.issues
  drop constraint if exists issues_slot_hour_check;

alter table public.issues
  add constraint issues_slot_hour_check check (slot_hour = 5);

comment on column public.issues.slot_hour is
  'Daily publication slot in Asia/Shanghai. Supported value: 5.';
