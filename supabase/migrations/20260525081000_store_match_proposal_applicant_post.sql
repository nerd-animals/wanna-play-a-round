alter table match_proposals
add column if not exists applicant_post_id text references match_posts(id) on delete cascade;

drop function if exists accept_match_proposal(text, text, text, timestamptz);

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
