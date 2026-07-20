create table if not exists public.review_request_nonces (
  nonce_hash text primary key check (nonce_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.review_request_nonces enable row level security;
revoke all on public.review_request_nonces from public, anon, authenticated;
grant select, insert, delete on public.review_request_nonces to service_role;

create or replace function public.reserve_review_request_nonce(
  p_nonce_hash text,
  p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if p_nonce_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'REVIEW_NONCE_HASH_INVALID';
  end if;
  if p_ttl_seconds < 60 or p_ttl_seconds > 3600 then
    raise exception 'REVIEW_NONCE_TTL_INVALID';
  end if;

  delete from public.review_request_nonces where expires_at <= now();
  insert into public.review_request_nonces (nonce_hash, expires_at)
  values (p_nonce_hash, now() + make_interval(secs => p_ttl_seconds))
  on conflict (nonce_hash) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.reserve_review_request_nonce(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_review_request_nonce(text, integer) to service_role;

comment on table public.review_request_nonces is
  'Release V2 reviewer replay reservations. Stores only nonce hashes and expires them automatically on reservation.';
