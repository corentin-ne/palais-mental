-- Palais Mental · friends.
-- The only things that ever leave a phone: ratings (when shared), recommendations, and what is said
-- about an episode. Libraries, progress and history stay on the device.
--
-- Everyone joins the same group ("base") with one access code, set by whoever joins first. Groups are
-- real in the schema (a member belongs to one), so more can be opened later without touching the data.

-- ------------------------------------------------------------------ Groups and members
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- The access code, hashed. No policy: only join_circle() reads it.
create table public.circle_secrets (
  circle_id uuid primary key references public.circles on delete cascade,
  code_hash bytea not null
);

create table public.join_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index join_attempts_user on public.join_attempts (user_id, at);

create table public.members (
  user_id uuid primary key references auth.users on delete cascade,
  circle_id uuid not null references public.circles on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  emoji text not null default '🙂' check (char_length(emoji) between 1 and 8),
  joined_at timestamptz not null default now()
);
create index members_circle on public.members (circle_id);

insert into public.circles (slug, name) values ('base', 'Base');

-- ------------------------------------------------------------------ Titles
-- The same film is "tmdb:603" on one phone and "imdb:tt0133093" on another: a title carries every key
-- it is known by, and two phones meet on any key they share. Just enough metadata to draw its card.
create table public.titles (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('show', 'movie', 'book', 'game')),
  keys text[] not null check (cardinality(keys) between 1 and 12),
  -- The id the app opens it with (TVmaze id, or the film, book or game id).
  route text not null check (char_length(route) between 1 and 200),
  title text not null check (char_length(title) between 1 and 300),
  year int,
  poster text check (char_length(poster) <= 600),
  created_at timestamptz not null default now()
);
create index titles_keys on public.titles using gin (keys);

-- ------------------------------------------------------------------ What friends share
create table public.ratings (
  user_id uuid not null default auth.uid() references public.members on delete cascade,
  title_id bigint not null references public.titles on delete cascade,
  -- 1–10: half stars.
  rating smallint not null check (rating between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table public.recos (
  user_id uuid not null default auth.uid() references public.members on delete cascade,
  title_id bigint not null references public.titles on delete cascade,
  note text check (char_length(note) <= 280),
  -- A rare one: five at most per kind (see recos_favorites).
  favorite boolean not null default false,
  -- "You should watch this": one friend it is meant for.
  to_user uuid references public.members on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- A friend thanking you for a recommendation.
create table public.reco_thanks (
  reco_user uuid not null,
  title_id bigint not null,
  from_user uuid not null default auth.uid() references public.members on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reco_user, title_id, from_user),
  foreign key (reco_user, title_id) references public.recos (user_id, title_id) on delete cascade
);

create table public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.members on delete cascade,
  title_id bigint not null references public.titles on delete cascade,
  -- TVmaze episode id.
  episode_id bigint not null,
  body text not null check (char_length(body) between 1 and 1000),
  rating smallint check (rating between 1 and 10),
  created_at timestamptz not null default now()
);
create index posts_title on public.posts (title_id, episode_id, created_at);

create table public.post_reactions (
  post_id bigint not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references public.members on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  primary key (post_id, user_id)
);

-- ------------------------------------------------------------------ Helpers
create function public.my_circle() returns uuid
language sql stable security definer set search_path = '' as $$
  select circle_id from public.members where user_id = (select auth.uid())
$$;

create function public.in_my_circle(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.user_id = uid and m.circle_id = public.my_circle())
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger ratings_touch before update on public.ratings for each row execute function public.touch_updated_at();

-- Five favourites per kind: what makes one worth a red band.
create function public.recos_favorites() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.favorite and (
    select count(*) from public.recos r join public.titles t on t.id = r.title_id
    where r.user_id = new.user_id and r.favorite and r.title_id <> new.title_id
      and t.kind = (select kind from public.titles where id = new.title_id)
  ) >= 5 then
    raise exception 'favorites_full';
  end if;
  return new;
end $$;
create trigger recos_favorites before insert or update on public.recos for each row execute function public.recos_favorites();

-- Join the group with its access code; the first to join sets it. Returns {ok, error?}.
create function public.join_circle(code text, name text, emoji text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  wanted bytea := sha256(convert_to(btrim(code), 'UTF8'));
  stored bytea;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if (select count(*) from public.join_attempts a where a.user_id = uid and a.at > now() - interval '1 hour') >= 8 then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  select c.id into cid from public.circles c where c.slug = 'base' for update;
  select s.code_hash into stored from public.circle_secrets s where s.circle_id = cid;
  if stored is null then
    if char_length(btrim(code)) < 6 then return jsonb_build_object('ok', false, 'error', 'code_short'); end if;
    insert into public.circle_secrets (circle_id, code_hash) values (cid, wanted);
  elsif stored <> wanted then
    insert into public.join_attempts (user_id) values (uid);
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  if (select count(*) from public.members m where m.circle_id = cid) >= 50 then
    return jsonb_build_object('ok', false, 'error', 'full');
  end if;
  insert into public.members (user_id, circle_id, name, emoji) values (uid, cid, btrim(name), btrim(emoji))
  on conflict (user_id) do update set name = excluded.name, emoji = excluded.emoji;
  return jsonb_build_object('ok', true, 'first', stored is null);
end $$;

-- Find or create titles by their keys; returns their ids in the order given.
create function public.upsert_titles(items jsonb) returns bigint[]
language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  ks text[];
  tid bigint;
  ids bigint[] := '{}';
begin
  if public.my_circle() is null then raise exception 'not_member'; end if;
  if jsonb_array_length(items) > 500 then raise exception 'too_many'; end if;
  for it in select * from jsonb_array_elements(items) loop
    ks := array(select jsonb_array_elements_text(it -> 'keys') limit 8);
    tid := null;
    select t.id into tid from public.titles t where t.kind = it ->> 'kind' and t.keys && ks order by t.id limit 1;
    if tid is null then
      insert into public.titles (kind, keys, route, title, year, poster)
      values (it ->> 'kind', ks, it ->> 'route', left(it ->> 'title', 300), nullif(it ->> 'year', '')::int, it ->> 'poster')
      returning id into tid;
    else
      update public.titles t
      set keys = array(select distinct k from unnest(t.keys || ks) k limit 12), poster = coalesce(t.poster, it ->> 'poster')
      where t.id = tid and not (t.keys @> ks and (t.poster is not null or it ->> 'poster' is null));
    end if;
    ids := ids || tid;
  end loop;
  return ids;
end $$;

-- Free projects pause after a week without a query: a scheduled workflow calls this.
create function public.ping() returns int language sql stable set search_path = '' as $$ select 1 $$;

-- ------------------------------------------------------------------ Who can do what
alter table public.circles enable row level security;
alter table public.circle_secrets enable row level security;
alter table public.join_attempts enable row level security;
alter table public.members enable row level security;
alter table public.titles enable row level security;
alter table public.ratings enable row level security;
alter table public.recos enable row level security;
alter table public.reco_thanks enable row level security;
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.circles, public.titles to authenticated;
grant select, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.ratings, public.recos, public.posts, public.post_reactions to authenticated;
grant select, insert, delete on public.reco_thanks to authenticated;
grant execute on function public.my_circle(), public.in_my_circle(uuid), public.join_circle(text, text, text), public.upsert_titles(jsonb) to authenticated;
grant execute on function public.ping() to anon, authenticated;

create policy circles_read on public.circles for select to authenticated using (id = (select public.my_circle()));

create policy members_read on public.members for select to authenticated using (circle_id = (select public.my_circle()));
create policy members_update on public.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and circle_id = (select public.my_circle()));
-- Leaving takes everything you shared with it (cascade).
create policy members_leave on public.members for delete to authenticated using (user_id = (select auth.uid()));

create policy titles_read on public.titles for select to authenticated using ((select public.my_circle()) is not null);

create policy ratings_read on public.ratings for select to authenticated using (public.in_my_circle(user_id));
create policy ratings_insert on public.ratings for insert to authenticated with check (user_id = (select auth.uid()) and (select public.my_circle()) is not null);
create policy ratings_update on public.ratings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ratings_delete on public.ratings for delete to authenticated using (user_id = (select auth.uid()));

create policy recos_read on public.recos for select to authenticated using (public.in_my_circle(user_id));
create policy recos_insert on public.recos for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.my_circle()) is not null and (to_user is null or public.in_my_circle(to_user)));
create policy recos_update on public.recos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (to_user is null or public.in_my_circle(to_user)));
create policy recos_delete on public.recos for delete to authenticated using (user_id = (select auth.uid()));

create policy thanks_read on public.reco_thanks for select to authenticated using (public.in_my_circle(from_user));
create policy thanks_insert on public.reco_thanks for insert to authenticated
  with check (from_user = (select auth.uid()) and public.in_my_circle(reco_user));
create policy thanks_delete on public.reco_thanks for delete to authenticated using (from_user = (select auth.uid()));

create policy posts_read on public.posts for select to authenticated using (public.in_my_circle(user_id));
create policy posts_insert on public.posts for insert to authenticated with check (user_id = (select auth.uid()) and (select public.my_circle()) is not null);
create policy posts_update on public.posts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated using (user_id = (select auth.uid()));

create policy reactions_read on public.post_reactions for select to authenticated using (public.in_my_circle(user_id));
create policy reactions_insert on public.post_reactions for insert to authenticated with check (user_id = (select auth.uid()) and (select public.my_circle()) is not null);
create policy reactions_update on public.post_reactions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reactions_delete on public.post_reactions for delete to authenticated using (user_id = (select auth.uid()));
