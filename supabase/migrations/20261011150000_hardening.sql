-- Palais Mental · Social, 1.6.2: hardening.
-- The group is open (a name is all it takes), so the database assumes a member can be a stranger:
-- nobody takes someone else's name, a title can't carry a link that leads out of the app, and one
-- account can't fill the database.

-- ------------------------------------------------------------------ One name each
create unique index members_name on public.members (circle_id, lower(btrim(name)));

create or replace function public.join_base(name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  wanted text := btrim(regexp_replace(name, '\s+', ' ', 'g'));
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if char_length(wanted) not between 1 and 24 then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  select c.id into cid from public.circles c where c.slug = 'base' for update;
  if exists (select 1 from public.members m where m.circle_id = cid and lower(btrim(m.name)) = lower(wanted) and m.user_id <> uid) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;
  if not exists (select 1 from public.members m where m.user_id = uid)
    and (select count(*) from public.members m where m.circle_id = cid) >= 50 then
    return jsonb_build_object('ok', false, 'error', 'full');
  end if;
  insert into public.members (user_id, circle_id, name) values (uid, cid, wanted)
  on conflict (user_id) do update set name = excluded.name;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------------ Titles: nothing that leads elsewhere
-- A route is an id the app opens (a TVmaze number, "tmdb-603"): never a path. Keys likewise.
alter table public.titles
  add constraint titles_route_plain check (route ~ '^[A-Za-z0-9._:_-]+$'),
  add constraint titles_poster_https check (poster is null or poster ~ '^https://[A-Za-z0-9.-]+/'),
  add column created_by uuid default auth.uid();

-- ------------------------------------------------------------------ Quotas
-- Far above what anyone does by hand; low enough that one account can't fill a free database.
create function public.quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n bigint;
  cap bigint;
begin
  if uid is null then return new; end if;
  if tg_table_name = 'titles' then
    select count(*) into n from public.titles t where t.created_by = uid;
    cap := 5000;
  elsif tg_table_name = 'ratings' then
    select count(*) into n from public.ratings r where r.user_id = uid;
    cap := 5000;
  elsif tg_table_name = 'recos' then
    select count(*) into n from public.recos r where r.user_id = uid;
    cap := 1000;
  elsif tg_table_name = 'posts' then
    select count(*) into n from public.posts p where p.user_id = uid and p.created_at > now() - interval '1 day';
    cap := 300;
  else
    return new;
  end if;
  if n >= cap then raise exception 'quota'; end if;
  return new;
end $$;
revoke execute on function public.quota() from public, anon, authenticated;

create trigger titles_quota before insert on public.titles for each row execute function public.quota();
create trigger ratings_quota before insert on public.ratings for each row execute function public.quota();
create trigger recos_quota before insert on public.recos for each row execute function public.quota();
create trigger posts_quota before insert on public.posts for each row execute function public.quota();

-- upsert_titles: the same, with the caller recorded, and a poster kept only when it is a plain https link.
create or replace function public.upsert_titles(items jsonb) returns bigint[]
language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  ks text[];
  tid bigint;
  art text;
  ids bigint[] := '{}';
begin
  if public.my_circle() is null then raise exception 'not_member'; end if;
  if jsonb_array_length(items) > 500 then raise exception 'too_many'; end if;
  for it in select * from jsonb_array_elements(items) loop
    ks := array(select left(k, 200) from jsonb_array_elements_text(it -> 'keys') k limit 8);
    art := case when it ->> 'poster' ~ '^https://[A-Za-z0-9.-]+/' and char_length(it ->> 'poster') <= 600 then it ->> 'poster' end;
    tid := null;
    select t.id into tid from public.titles t where t.kind = it ->> 'kind' and t.keys && ks order by t.id limit 1;
    if tid is null then
      insert into public.titles (kind, keys, route, title, year, poster, created_by)
      values (it ->> 'kind', ks, it ->> 'route', left(it ->> 'title', 300), nullif(it ->> 'year', '')::int, art, auth.uid())
      returning id into tid;
    else
      update public.titles t
      set keys = array(select distinct k from unnest(t.keys || ks) k limit 12), poster = coalesce(t.poster, art)
      where t.id = tid and not (t.keys @> ks and (t.poster is not null or art is null));
    end if;
    ids := ids || tid;
  end loop;
  return ids;
end $$;
