import { expect, test } from "@playwright/test";
import {
  cleanupStaleE2eData,
  E2EWorld,
  hasSupabaseConfig,
  loginAs,
  sessionCookieHeader,
} from "./support/supabase-fixtures";

const dbTest = test.extend<{ world: E2EWorld }>({
  world: async ({}, use, testInfo) => {
    const world = new E2EWorld(testInfo);
    try {
      await use(world);
    } finally {
      await world.cleanup();
    }
  },
});

dbTest.describe("Tier B Supabase-backed E2E flows", () => {
  dbTest.describe.configure({ mode: "serial" });

  dbTest.skip(
    !hasSupabaseConfig(),
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Tier B E2E",
  );

  dbTest.beforeAll(async () => {
    await cleanupStaleE2eData();
  });

  dbTest("creates a team through the UI and deletes the account with cascade", async ({
    page,
    world,
  }) => {
    const owner = await world.createUser("owner");
    const teamName = `${world.prefix} Team UI`;
    const teamDescription = `${world.prefix} created from Playwright`;

    await loginAs(page.context(), owner.id);
    await page.goto("/dashboard");

    await expect(page.locator("h1")).toContainText(owner.username);
    await expect(page.locator('a[href="/teams/new"]')).toBeVisible();

    await page.goto("/teams/new");
    await page.locator('input[name="name"]').fill(teamName);
    await page.locator('textarea[name="description"]').fill(teamDescription);
    await page.locator('input[name="activityTime"]').fill("Weekdays 21:00-24:00");

    await Promise.all([
      page.waitForURL(/\/teams\/[^/?]+$/),
      page.locator('form[action="/api/teams"] button[type="submit"]').click(),
    ]);

    const team = await world.findTeamByOwnerAndName(owner, teamName);
    await expect(page).toHaveURL(new RegExp(`/teams/${team.id}$`));
    await expect(page.getByText(teamName)).toBeVisible();
    await expect(page.getByText(teamDescription)).toBeVisible();

    await page.goto("/dashboard");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      page.locator('form[action="/api/auth/account"] button[type="submit"]').click(),
    ]);

    await expect.poll(() => world.countRows("users", "id", owner.id)).toBe(0);
    await expect.poll(() => world.countRows("teams", "id", team.id)).toBe(0);
  });

  dbTest("creates an invite through the UI and joins with a Riot profile", async ({
    page,
    world,
  }) => {
    const owner = await world.createUser("owner");
    const team = await world.createTeam(owner, "invite-ui");
    const joiner = await world.createUser("joiner");

    await loginAs(page.context(), owner.id);
    await page.goto(`/teams/${team.id}`);
    await page.locator('form[action$="/invite-links"] input[name="maxUses"]').fill("5");

    await Promise.all([
      page.waitForURL(/inviteCreated=1/),
      page.locator('form[action$="/invite-links"] button[type="submit"]').click(),
    ]);

    const invite = await world.findLatestInvite(team);
    await expect(page.getByText(`/join/${invite.token}`)).toBeVisible();

    await loginAs(page.context(), joiner.id);
    await page.goto(`/join/${invite.token}`);
    await expect(page.getByRole("heading", { name: team.name })).toBeVisible();

    await page.locator('input[name="riotGameName"]').fill("E2ERift");
    await page.locator('input[name="riotTagLine"]').fill("KR1");
    await page.locator('select[name="soloTier"]').selectOption("GOLD");

    await Promise.all([
      page.waitForURL(/joined=1/),
      page
        .locator(`form[action="/api/invite-links/${invite.token}/join"] button[type="submit"]`)
        .click(),
    ]);

    const member = await world.getTeamMember(team, joiner);
    expect(member).toMatchObject({
      display_name: "E2ERift#KR1",
      riot_game_name: "E2ERift",
      riot_tag_line: "KR1",
      solo_tier: "GOLD",
      status: "ACTIVE",
    });
    await expect.poll(() => world.getInviteUsedCount(invite)).toBe(1);

    await loginAs(page.context(), owner.id);
    await page.goto(`/teams/${team.id}`);
    await expect(page.getByText("E2ERift#KR1", { exact: true })).toBeVisible();
    await expect(page.getByText(/Riot E2ERift#KR1 \/ GOLD/)).toBeVisible();
  });

  dbTest("rejects invite joins for Discord users outside the guild", async ({
    page,
    world,
  }) => {
    const owner = await world.createUser("owner");
    const team = await world.createTeam(owner, "guild-gate");
    const invite = await world.createInvite(team, owner);
    const outsider = await world.createUser("outsider", { guildMember: false });

    await loginAs(page.context(), outsider.id);
    await page.goto(`/join/${invite.token}`);
    await page.locator('input[name="riotGameName"]').fill("OutsideRift");
    await page.locator('input[name="riotTagLine"]').fill("KR1");
    await page.locator('select[name="soloTier"]').selectOption("SILVER");

    await Promise.all([
      page.waitForURL(/error=DISCORD_GUILD_MEMBERSHIP_REQUIRED/),
      page
        .locator(`form[action="/api/invite-links/${invite.token}/join"] button[type="submit"]`)
        .click(),
    ]);

    await expect(page.getByText("DISCORD_GUILD_MEMBERSHIP_REQUIRED")).toBeVisible();
    await expect.poll(() => world.countRows("team_members", "user_id", outsider.id)).toBe(0);
    await expect.poll(() => world.getInviteUsedCount(invite)).toBe(0);
  });

  dbTest("rejects the sixth active member with TEAM_FULL", async ({ page, world }) => {
    const owner = await world.createUser("owner");
    const team = await world.createTeam(owner, "full-team");
    const invite = await world.createInvite(team, owner);
    await world.createFullRoster(team);
    const sixth = await world.createUser("sixth");

    await loginAs(page.context(), sixth.id);
    await page.goto(`/join/${invite.token}`);
    await page.locator('input[name="riotGameName"]').fill("SixthRift");
    await page.locator('input[name="riotTagLine"]').fill("KR1");
    await page.locator('select[name="soloTier"]').selectOption("PLATINUM");

    await Promise.all([
      page.waitForURL(/error=TEAM_FULL/),
      page
        .locator(`form[action="/api/invite-links/${invite.token}/join"] button[type="submit"]`)
        .click(),
    ]);

    await expect(page.getByText("TEAM_FULL")).toBeVisible();
    await expect.poll(() => world.countRows("team_members", "user_id", sixth.id)).toBe(0);
    await expect.poll(() => world.getInviteUsedCount(invite)).toBe(0);
  });

  dbTest("registers match posts only after the roster is complete", async ({
    page,
    world,
  }) => {
    const owner = await world.createUser("owner");
    const incompleteTeam = await world.createTeam(owner, "incomplete-match");
    const fullTeam = await world.createTeam(owner, "complete-match");
    await world.createFullRoster(fullTeam);
    const blockedTitle = `${world.prefix} blocked match`;
    const openTitle = `${world.prefix} open match`;

    await loginAs(page.context(), owner.id);
    await page.goto(`/teams/${incompleteTeam.id}/matches/new`);
    await page.locator('input[name="title"]').fill(blockedTitle);

    await Promise.all([
      page.waitForURL(/error=TEAM_NOT_COMPLETE/),
      page.locator('form[action$="/matches"] button[type="submit"]').click(),
    ]);

    await expect(page.getByText("TEAM_NOT_COMPLETE")).toBeVisible();
    await expect(await world.getMatchPostByTitle(incompleteTeam, blockedTitle)).toBeNull();

    await page.goto(`/teams/${fullTeam.id}/matches/new`);
    await page.locator('input[name="title"]').fill(openTitle);
    await page.locator('textarea[name="description"]').fill("E2E match post description");
    await page.locator('input[name="availableTime"]').fill("2099-12-31T22:00");

    await Promise.all([
      page.waitForURL(/matchCreated=1/),
      page.locator('form[action$="/matches"] button[type="submit"]').click(),
    ]);

    await expect(page.getByText(openTitle)).toBeVisible();
    await expect.poll(async () => {
      const post = await world.getMatchPostByTitle(fullTeam, openTitle);
      return post?.status;
    }).toBe("OPEN");
  });

  dbTest("proposes and accepts a match through API routes", async ({
    request,
    world,
  }) => {
    const targetOwner = await world.createUser("target-owner");
    const applicantOwner = await world.createUser("applicant-owner");
    const targetTeam = await world.createTeam(targetOwner, "target");
    const applicantTeam = await world.createTeam(applicantOwner, "applicant");
    await world.createFullRoster(targetTeam);
    await world.createFullRoster(applicantTeam);
    const targetPost = await world.createMatchPost(targetTeam, targetOwner, "target");
    const applicantPost = await world.createMatchPost(
      applicantTeam,
      applicantOwner,
      "applicant",
    );

    const proposeResponse = await request.post("/api/match-proposals", {
      headers: { cookie: sessionCookieHeader(applicantOwner.id) },
      data: {
        postId: targetPost.id,
        teamId: applicantTeam.id,
      },
    });
    expect(proposeResponse.status()).toBe(201);
    const proposeBody = await proposeResponse.json();
    expect(proposeBody.ok).toBe(true);
    expect(proposeBody.data).toMatchObject({
      postId: targetPost.id,
      applicantTeamId: applicantTeam.id,
      status: "PENDING",
    });

    const listResponse = await request.get(
      `/api/match-proposals?postId=${targetPost.id}`,
      {
        headers: { cookie: sessionCookieHeader(targetOwner.id) },
      },
    );
    expect(listResponse.status()).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data).toHaveLength(1);

    const proposalId = proposeBody.data.id as string;
    const acceptResponse = await request.post(
      `/api/match-proposals/${proposalId}/accept`,
      {
        headers: { cookie: sessionCookieHeader(targetOwner.id) },
      },
    );
    expect(acceptResponse.status()).toBe(200);
    const acceptBody = await acceptResponse.json();
    expect(acceptBody.ok).toBe(true);
    expect(acceptBody.data.match).toMatchObject({
      leftPostId: targetPost.id,
      rightPostId: applicantPost.id,
      origin: "MANUAL",
    });

    await expect.poll(() => world.getProposalStatus(proposalId)).toBe("ACCEPTED");
    await expect.poll(async () => {
      const post = await world.getMatchPostByTitle(targetTeam, targetPost.title);
      return post?.status;
    }).toBe("CLOSED");
    await expect.poll(async () => {
      const post = await world.getMatchPostByTitle(applicantTeam, applicantPost.title);
      return post?.status;
    }).toBe("CLOSED");
  });

  dbTest("proposes and accepts a match through the team page UI", async ({
    page,
    world,
  }) => {
    const targetOwner = await world.createUser("ui-target-owner");
    const applicantOwner = await world.createUser("ui-applicant-owner");
    const targetTeam = await world.createTeam(targetOwner, "ui-target");
    const applicantTeam = await world.createTeam(applicantOwner, "ui-applicant");
    await world.createFullRoster(targetTeam);
    await world.createFullRoster(applicantTeam);
    const targetPost = await world.createMatchPost(
      targetTeam,
      targetOwner,
      "ui-target",
    );
    const applicantPost = await world.createMatchPost(
      applicantTeam,
      applicantOwner,
      "ui-applicant",
    );

    await loginAs(page.context(), applicantOwner.id);
    await page.goto(`/teams/${applicantTeam.id}`);
    await expect(page.getByRole("heading", { name: "수동 매칭" })).toBeVisible();

    const candidate = page.getByTestId(`manual-match-candidate-${targetPost.id}`);
    await expect(candidate).toContainText(targetTeam.name);
    await expect(candidate).toContainText(targetPost.title);

    await Promise.all([
      page.waitForURL(/proposalSent=1/),
      candidate.getByRole("button", { name: "매칭 신청" }).click(),
    ]);

    await expect(page.getByText("매칭 신청 완료")).toBeVisible();
    const proposal = await world.findLatestProposal(targetPost, applicantTeam);
    expect(proposal).toMatchObject({
      status: "PENDING",
      applicantPostId: applicantPost.id,
    });
    await expect(
      page.getByTestId(`manual-match-outgoing-${proposal.id}`),
    ).toContainText("대기 중");

    await loginAs(page.context(), targetOwner.id);
    await page.goto(`/teams/${targetTeam.id}`);

    const incoming = page.getByTestId(`manual-match-incoming-${proposal.id}`);
    await expect(incoming).toContainText(applicantTeam.name);
    await expect(incoming).toContainText(applicantPost.title);

    await Promise.all([
      page.waitForURL(/matchConfirmed=1/),
      incoming.getByRole("button", { name: "수락" }).click(),
    ]);

    await expect(page.getByText("매칭 확정 완료")).toBeVisible();
    await expect.poll(() => world.getProposalStatus(proposal.id)).toBe("ACCEPTED");
    await expect.poll(async () => {
      const post = await world.getMatchPostByTitle(targetTeam, targetPost.title);
      return post?.status;
    }).toBe("CLOSED");
    await expect.poll(async () => {
      const post = await world.getMatchPostByTitle(applicantTeam, applicantPost.title);
      return post?.status;
    }).toBe("CLOSED");
    await expect(
      page.getByText(`${targetPost.title} vs ${applicantPost.title}`),
    ).toBeVisible();

    await loginAs(page.context(), applicantOwner.id);
    await page.goto(`/teams/${applicantTeam.id}`);
    await expect(
      page.getByText(`${applicantPost.title} vs ${targetPost.title}`),
    ).toBeVisible();
  });
});
