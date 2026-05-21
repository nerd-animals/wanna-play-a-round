import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    env: {
      DISCORD_CLIENT_ID: 'playwright-client-id',
      DISCORD_CLIENT_SECRET: 'playwright-client-secret',
      DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
      E2E_DISABLE_DISCORD_NOTIFICATIONS: '1',
      E2E_DISCORD_GUILD_MEMBER_ID_PREFIXES: 'e2e-discord-member-',
      E2E_DISCORD_GUILD_NON_MEMBER_ID_PREFIXES: 'e2e-discord-nonmember-',
    },
    reuseExistingServer: !process.env.CI,
  },
});
