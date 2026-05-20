create table if not exists users (
  id text primary key,
  discord_user_id text not null unique,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  name text not null,
  description text,
  activity_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_members (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  user_id text references users(id) on delete set null,
  display_name text,
  role text not null check (role in ('OWNER', 'MEMBER')),
  status text not null check (status in ('PENDING', 'ACTIVE', 'REMOVED')),
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (team_id, user_id)
);

create table if not exists team_invite_links (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  token text not null unique,
  created_by_user_id text not null references users(id) on delete cascade,
  status text not null check (status in ('ACTIVE', 'EXPIRED', 'DISABLED')),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists match_posts (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  title text not null,
  description text,
  min_tier text,
  max_tier text,
  available_time text,
  status text not null check (status in ('OPEN', 'CLOSED', 'CANCELLED')),
  created_by_user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
