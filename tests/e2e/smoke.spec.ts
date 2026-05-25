import { expect, test } from "@playwright/test";

test.describe("Public pages smoke", () => {
  test("home renders hero and login CTA for logged-out visitors", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /스크림을 잡기 위한 팀 등록/ }),
    ).toBeVisible();

    const loginCta = page.getByRole("link", { name: /디스코드 로그인 시작/ });
    await expect(loginCta).toBeVisible();
    await expect(loginCta).toHaveAttribute("href", "/api/auth/discord/login");

    await expect(page.getByText("세션 없음")).toBeVisible();
  });

  test("home with ?error= shows the discord login error alert", async ({ page }) => {
    await page.goto("/?error=missing_state");

    await expect(page.getByText("로그인 오류")).toBeVisible();
    await expect(page.getByText(/missing_state/)).toBeVisible();
  });

  test("privacy page renders its heading", async ({ page }) => {
    await page.goto("/privacy");

    await expect(
      page.getByRole("heading", { name: "ScrimFinder Privacy Policy" }),
    ).toBeVisible();
  });

  test("terms page renders its heading", async ({ page }) => {
    await page.goto("/terms");

    await expect(
      page.getByRole("heading", { name: "ScrimFinder Terms of Service" }),
    ).toBeVisible();
  });
});

test.describe("Tier A auth and guard flows", () => {
  test("dashboard redirects logged-out visitors to home", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL("/");
    await expect(page.getByText("세션 없음")).toBeVisible();
  });

  test("new team page redirects logged-out visitors to home", async ({ page }) => {
    await page.goto("/teams/new");

    await expect(page).toHaveURL("/");
    await expect(page.getByText("세션 없음")).toBeVisible();
  });

  test("join page prompts logged-out visitors to sign in with Discord", async ({ page }) => {
    await page.goto("/join/playwright-token");

    await expect(
      page.getByRole("heading", { name: "Discord 로그인이 필요합니다" }),
    ).toBeVisible();

    const loginCta = page.getByRole("link", { name: "디스코드 로그인 시작" });
    await expect(loginCta).toBeVisible();
    await expect(loginCta).toHaveAttribute("href", "/api/auth/discord/login");
  });

  test("discord login redirects to authorize URL and stores oauth state", async ({ request }) => {
    const response = await request.get("/api/auth/discord/login", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);

    const location = response.headers().location;
    expect(location).toContain("https://discord.com/api/oauth2/authorize?");

    const authorizeUrl = new URL(location);
    expect(authorizeUrl.searchParams.get("client_id")).toBe("playwright-client-id");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/discord/callback",
    );
    expect(authorizeUrl.searchParams.get("state")).toBeTruthy();

    expect(response.headers()["set-cookie"]).toContain("sf_discord_oauth_state=");
  });

  test("logout clears session cookie and redirects home", async ({ request }) => {
    const response = await request.post("/api/auth/logout", {
      headers: {
        cookie: "sf_owner_session=playwright-user",
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    expect(new URL(response.headers().location).pathname).toBe("/");
    expect(response.headers()["set-cookie"]).toContain("sf_owner_session=");
    expect(response.headers()["set-cookie"]).toContain("Expires=Thu, 01 Jan 1970");
  });
});
