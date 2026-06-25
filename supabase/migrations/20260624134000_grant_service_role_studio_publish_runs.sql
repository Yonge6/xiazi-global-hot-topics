grant select, insert, update, delete on table public.studio_publish_runs to service_role;

revoke all on table public.studio_publish_runs from anon;
revoke all on table public.studio_publish_runs from authenticated;
