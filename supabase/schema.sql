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
  user_id text references users(id) on delete cascade,
  display_name text,
  riot_game_name text,
  riot_tag_line text,
  solo_tier text check (solo_tier in ('IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER')),
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

create table if not exists matches (
  id text primary key,
  left_post_id text not null references match_posts(id) on delete cascade,
  right_post_id text not null references match_posts(id) on delete cascade,
  left_team_id text not null references teams(id) on delete cascade,
  right_team_id text not null references teams(id) on delete cascade,
  origin text not null check (origin in ('MANUAL', 'AUTO')),
  confirmed_at timestamptz not null default now()
);

create table if not exists match_proposals (
  id text primary key,
  post_id text not null references match_posts(id) on delete cascade,
  applicant_team_id text not null references teams(id) on delete cascade,
  applicant_post_id text references match_posts(id) on delete cascade,
  status text not null check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
  created_by_user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists match_proposals_pending_unique
on match_proposals (post_id, applicant_team_id)
where status = 'PENDING';

create or replace function is_match_post_expired(available_time text)
returns boolean
language plpgsql
stable
as $$
begin
  if available_time is null or btrim(available_time) = '' then
    return false;
  end if;

  begin
    return available_time::timestamptz < now();
  exception when others then
    return true;
  end;
end;
$$;

create or replace function increment_invite_link_used_count(link_id text)
returns void
language sql
as $$
  update team_invite_links
  set used_count = used_count + 1
  where id = link_id
    and (max_uses is null or used_count < max_uses);
$$;

create or replace function join_team_by_invite(
  p_link_id text,
  p_team_id text,
  p_member_id text,
  p_user_id text,
  p_display_name text,
  p_riot_game_name text,
  p_riot_tag_line text,
  p_solo_tier text,
  p_joined_at timestamptz
)
returns table (
  result_code text,
  member_id text,
  member_team_id text,
  member_user_id text,
  member_display_name text,
  member_riot_game_name text,
  member_riot_tag_line text,
  member_solo_tier text,
  member_role text,
  member_status text,
  member_created_at timestamptz,
  member_joined_at timestamptz
)
language plpgsql
as $$
declare
  v_link team_invite_links%rowtype;
  v_member team_members%rowtype;
  v_has_member boolean := false;
  v_active_count integer := 0;
begin
  perform 1
  from teams
  where teams.id = p_team_id
  for update;

  if not found then
    result_code := 'TEAM_NOT_FOUND';
    return next;
    return;
  end if;

  select *
  into v_link
  from team_invite_links
  where team_invite_links.id = p_link_id
    and team_invite_links.team_id = p_team_id
  for update;

  if not found then
    result_code := 'INVITE_NOT_FOUND';
    return next;
    return;
  end if;

  if v_link.status <> 'ACTIVE' or (v_link.expires_at is not null and v_link.expires_at < now()) then
    result_code := 'INVITE_INACTIVE';
    return next;
    return;
  end if;

  if v_link.max_uses is not null and v_link.used_count >= v_link.max_uses then
    result_code := 'INVITE_EXHAUSTED';
    return next;
    return;
  end if;

  select *
  into v_member
  from team_members
  where team_members.team_id = p_team_id
    and team_members.user_id = p_user_id
  for update;
  v_has_member := found;

  if v_has_member and v_member.status = 'ACTIVE' then
    update team_members
    set display_name = p_display_name,
        riot_game_name = p_riot_game_name,
        riot_tag_line = p_riot_tag_line,
        solo_tier = p_solo_tier
    where team_members.id = v_member.id
    returning * into v_member;

    result_code := 'OK_REUSED';
    member_id := v_member.id;
    member_team_id := v_member.team_id;
    member_user_id := v_member.user_id;
    member_display_name := v_member.display_name;
    member_riot_game_name := v_member.riot_game_name;
    member_riot_tag_line := v_member.riot_tag_line;
    member_solo_tier := v_member.solo_tier;
    member_role := v_member.role;
    member_status := v_member.status;
    member_created_at := v_member.created_at;
    member_joined_at := v_member.joined_at;
    return next;
    return;
  end if;

  select count(*)
  into v_active_count
  from team_members
  where team_members.team_id = p_team_id
    and team_members.status = 'ACTIVE';

  if v_active_count >= 5 then
    result_code := 'TEAM_FULL';
    return next;
    return;
  end if;

  if v_has_member then
    update team_members
    set status = 'ACTIVE',
        display_name = p_display_name,
        riot_game_name = p_riot_game_name,
        riot_tag_line = p_riot_tag_line,
        solo_tier = p_solo_tier,
        joined_at = p_joined_at
    where team_members.id = v_member.id
    returning * into v_member;
  else
    insert into team_members (
      id,
      team_id,
      user_id,
      display_name,
      riot_game_name,
      riot_tag_line,
      solo_tier,
      role,
      status,
      created_at,
      joined_at
    )
    values (
      p_member_id,
      p_team_id,
      p_user_id,
      p_display_name,
      p_riot_game_name,
      p_riot_tag_line,
      p_solo_tier,
      'MEMBER',
      'ACTIVE',
      p_joined_at,
      p_joined_at
    )
    returning * into v_member;
  end if;

  update team_invite_links
  set used_count = used_count + 1
  where team_invite_links.id = v_link.id;

  result_code := 'OK_CREATED';
  member_id := v_member.id;
  member_team_id := v_member.team_id;
  member_user_id := v_member.user_id;
  member_display_name := v_member.display_name;
  member_riot_game_name := v_member.riot_game_name;
  member_riot_tag_line := v_member.riot_tag_line;
  member_solo_tier := v_member.solo_tier;
  member_role := v_member.role;
  member_status := v_member.status;
  member_created_at := v_member.created_at;
  member_joined_at := v_member.joined_at;
  return next;
end;
$$;

create or replace function accept_match_proposal(
  p_proposal_id text,
  p_actor_user_id text,
  p_match_id text,
  p_confirmed_at timestamptz
)
returns table (
  result_code text,
  proposal_id text,
  proposal_post_id text,
  proposal_applicant_team_id text,
  proposal_applicant_post_id text,
  proposal_status text,
  proposal_created_by_user_id text,
  proposal_created_at timestamptz,
  proposal_updated_at timestamptz,
  match_id text,
  match_left_post_id text,
  match_right_post_id text,
  match_left_team_id text,
  match_right_team_id text,
  match_origin text,
  match_confirmed_at timestamptz
)
language plpgsql
as $$
declare
  v_proposal match_proposals%rowtype;
  v_target_post match_posts%rowtype;
  v_applicant_post match_posts%rowtype;
  v_target_team teams%rowtype;
  v_match matches%rowtype;
  v_updated_at timestamptz := now();
begin
  select *
  into v_proposal
  from match_proposals
  where match_proposals.id = p_proposal_id
  for update;

  if not found then
    result_code := 'PROPOSAL_NOT_FOUND';
    return next;
    return;
  end if;

  if v_proposal.status <> 'PENDING' then
    result_code := 'PROPOSAL_NOT_PENDING';
    return next;
    return;
  end if;

  select *
  into v_target_post
  from match_posts
  where match_posts.id = v_proposal.post_id;

  if not found then
    result_code := 'MATCH_POST_NOT_FOUND';
    return next;
    return;
  end if;

  if v_proposal.applicant_post_id is null then
    select *
    into v_applicant_post
    from match_posts
    where match_posts.team_id = v_proposal.applicant_team_id
      and match_posts.status = 'OPEN'
    order by match_posts.created_at desc
    limit 1;
  else
    select *
    into v_applicant_post
    from match_posts
    where match_posts.id = v_proposal.applicant_post_id;
  end if;

  if not found then
    result_code := 'APPLICANT_OPEN_MATCH_NOT_FOUND';
    return next;
    return;
  end if;

  perform 1
  from match_posts
  where match_posts.id in (v_target_post.id, v_applicant_post.id)
  order by match_posts.id
  for update;

  select *
  into v_target_post
  from match_posts
  where match_posts.id = v_proposal.post_id;

  select *
  into v_applicant_post
  from match_posts
  where match_posts.id = v_applicant_post.id;

  select *
  into v_target_team
  from teams
  where teams.id = v_target_post.team_id;

  if not found then
    result_code := 'TEAM_NOT_FOUND';
    return next;
    return;
  end if;

  if v_target_team.owner_user_id <> p_actor_user_id then
    result_code := 'FORBIDDEN';
    return next;
    return;
  end if;

  if v_target_post.status <> 'OPEN' or v_applicant_post.status <> 'OPEN' then
    result_code := 'MATCH_POST_ALREADY_CLOSED';
    return next;
    return;
  end if;

  if is_match_post_expired(v_target_post.available_time) then
    update match_posts
    set status = 'CLOSED',
        updated_at = v_updated_at
    where match_posts.id = v_target_post.id
      and match_posts.status = 'OPEN';

    result_code := 'MATCH_POST_ALREADY_CLOSED';
    return next;
    return;
  end if;

  if is_match_post_expired(v_applicant_post.available_time) then
    update match_posts
    set status = 'CLOSED',
        updated_at = v_updated_at
    where match_posts.id = v_applicant_post.id
      and match_posts.status = 'OPEN';

    result_code := 'MATCH_POST_ALREADY_CLOSED';
    return next;
    return;
  end if;

  update match_posts
  set status = 'CLOSED',
      updated_at = v_updated_at
  where match_posts.id in (v_target_post.id, v_applicant_post.id);

  insert into matches (
    id,
    left_post_id,
    right_post_id,
    left_team_id,
    right_team_id,
    origin,
    confirmed_at
  )
  values (
    p_match_id,
    v_target_post.id,
    v_applicant_post.id,
    v_target_post.team_id,
    v_proposal.applicant_team_id,
    'MANUAL',
    p_confirmed_at
  )
  returning * into v_match;

  update match_proposals
  set status = 'ACCEPTED',
      updated_at = v_updated_at
  where match_proposals.id = v_proposal.id
  returning * into v_proposal;

  result_code := 'OK';
  proposal_id := v_proposal.id;
  proposal_post_id := v_proposal.post_id;
  proposal_applicant_team_id := v_proposal.applicant_team_id;
  proposal_applicant_post_id := v_proposal.applicant_post_id;
  proposal_status := v_proposal.status;
  proposal_created_by_user_id := v_proposal.created_by_user_id;
  proposal_created_at := v_proposal.created_at;
  proposal_updated_at := v_proposal.updated_at;
  match_id := v_match.id;
  match_left_post_id := v_match.left_post_id;
  match_right_post_id := v_match.right_post_id;
  match_left_team_id := v_match.left_team_id;
  match_right_team_id := v_match.right_team_id;
  match_origin := v_match.origin;
  match_confirmed_at := v_match.confirmed_at;
  return next;
end;
$$;
