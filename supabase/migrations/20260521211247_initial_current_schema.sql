create table if not exists public.users (
  id text primary key,
  discord_user_id text not null unique,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  owner_user_id text not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  activity_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.teams
  drop constraint if exists teams_owner_user_id_key;

create table if not exists public.team_members (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  user_id text references public.users(id) on delete cascade,
  display_name text,
  riot_game_name text,
  riot_tag_line text,
  solo_tier text,
  role text not null check (role in ('OWNER', 'MEMBER')),
  status text not null check (status in ('PENDING', 'ACTIVE', 'REMOVED')),
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (team_id, user_id)
);

alter table if exists public.team_members
  add column if not exists riot_game_name text;

alter table if exists public.team_members
  add column if not exists riot_tag_line text;

alter table if exists public.team_members
  add column if not exists solo_tier text;

alter table if exists public.team_members
  drop constraint if exists team_members_solo_tier_check;

alter table if exists public.team_members
  add constraint team_members_solo_tier_check
  check (
    solo_tier is null
    or solo_tier in (
      'IRON',
      'BRONZE',
      'SILVER',
      'GOLD',
      'PLATINUM',
      'EMERALD',
      'DIAMOND',
      'MASTER',
      'GRANDMASTER',
      'CHALLENGER'
    )
  );

alter table if exists public.team_members
  drop constraint if exists team_members_user_id_fkey;

alter table if exists public.team_members
  add constraint team_members_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

create table if not exists public.team_invite_links (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  token text not null unique,
  created_by_user_id text not null references public.users(id) on delete cascade,
  status text not null check (status in ('ACTIVE', 'EXPIRED', 'DISABLED')),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.match_posts (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  title text not null,
  description text,
  min_tier text,
  max_tier text,
  available_time text,
  status text not null check (status in ('OPEN', 'CLOSED', 'CANCELLED')),
  created_by_user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  left_post_id text not null references public.match_posts(id) on delete cascade,
  right_post_id text not null references public.match_posts(id) on delete cascade,
  left_team_id text not null references public.teams(id) on delete cascade,
  right_team_id text not null references public.teams(id) on delete cascade,
  origin text not null check (origin in ('MANUAL', 'AUTO')),
  confirmed_at timestamptz not null default now()
);

create table if not exists public.match_proposals (
  id text primary key,
  post_id text not null references public.match_posts(id) on delete cascade,
  applicant_team_id text not null references public.teams(id) on delete cascade,
  status text not null check (
    status in ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')
  ),
  created_by_user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, applicant_team_id)
);

create or replace function public.increment_invite_link_used_count(link_id text)
returns void
language sql
as $$
  update public.team_invite_links
  set used_count = used_count + 1
  where id = link_id;
$$;
