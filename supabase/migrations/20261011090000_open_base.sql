-- Palais Mental · Social, 1.6.1.
-- Everyone is in the same group as soon as they choose a name: no access code for "base".
-- Codes (circle_secrets) stay in the schema for the day there are several groups.
-- Members are a name and nothing else: the emoji column is kept (1.6.0 sends one) but no longer read.

-- Choose a name: joins "base", or renames you if you are already in. Returns {ok, error?}.
create function public.join_base(name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if char_length(btrim(name)) not between 1 and 24 then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  select c.id into cid from public.circles c where c.slug = 'base' for update;
  if not exists (select 1 from public.members m where m.user_id = uid)
    and (select count(*) from public.members m where m.circle_id = cid) >= 50 then
    return jsonb_build_object('ok', false, 'error', 'full');
  end if;
  insert into public.members (user_id, circle_id, name) values (uid, cid, btrim(name))
  on conflict (user_id) do update set name = excluded.name;
  return jsonb_build_object('ok', true);
end $$;

-- 1.6.0 still calls this with a code: it is ignored.
create or replace function public.join_circle(code text, name text, emoji text) returns jsonb
language sql security definer set search_path = '' as $$
  select public.join_base(name)
$$;

revoke execute on function public.join_base(text) from public, anon;
grant execute on function public.join_base(text) to authenticated;

-- A band of your own on a recommendation: a few words quoted across the poster ("A masterpiece" — Pierre),
-- in the colour you pick, with your stars above them if you want.
alter table public.recos
  add column band text check (char_length(band) between 1 and 40),
  add column band_color text check (band_color in ('red', 'blue', 'green', 'purple', 'orange', 'black')),
  add column band_rating smallint check (band_rating between 1 and 10);
