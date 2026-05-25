import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import {
  isAuthorizedAdminRequest,
  readMaxAverageTierDelta,
} from "@/server/admin/auto-match";
import { runAutoMatch } from "@/server/jobs/auto-match";

vi.mock("@/server/jobs/auto-match", () => ({
  runAutoMatch: vi.fn(async ({ maxAverageTierDelta }: { maxAverageTierDelta: number }) => ({
    dryRun: true,
    maxAverageTierDelta,
    candidates: [
      {
        leftPostId: "left-post",
        rightPostId: "right-post",
        leftTeamId: "left-team",
        rightTeamId: "right-team",
        availableTime: "2099-12-31T22:00:00.000Z",
        averageTierDelta: 0.5,
      },
    ],
  })),
}));

const originalAdminJobSecret = process.env.ADMIN_JOB_SECRET;

function request(
  path = "/api/admin/auto-match",
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("admin auto-match route", () => {
  afterEach(() => {
    process.env.ADMIN_JOB_SECRET = originalAdminJobSecret;
    vi.clearAllMocks();
  });

  it("requires the configured admin secret", () => {
    process.env.ADMIN_JOB_SECRET = "secret";

    expect(isAuthorizedAdminRequest(request())).toBe(false);
    expect(
      isAuthorizedAdminRequest(request("/api/admin/auto-match", {
        authorization: "Bearer wrong",
      })),
    ).toBe(false);
    expect(
      isAuthorizedAdminRequest(request("/api/admin/auto-match", {
        authorization: "Bearer secret",
      })),
    ).toBe(true);
  });

  it("reads and validates maxAverageTierDelta", () => {
    expect(readMaxAverageTierDelta(request())).toBe(1);
    expect(readMaxAverageTierDelta(request("/api/admin/auto-match?maxAverageTierDelta=2.5"))).toBe(2.5);
    expect(readMaxAverageTierDelta(request("/api/admin/auto-match?maxAverageTierDelta=-1"))).toBeNull();
    expect(readMaxAverageTierDelta(request("/api/admin/auto-match?maxAverageTierDelta=11"))).toBeNull();
    expect(readMaxAverageTierDelta(request("/api/admin/auto-match?maxAverageTierDelta=nope"))).toBeNull();
  });

  it("returns unauthorized without a valid secret", async () => {
    process.env.ADMIN_JOB_SECRET = "secret";

    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "UNAUTHORIZED",
    });
    expect(runAutoMatch).not.toHaveBeenCalled();
  });

  it("runs auto-match in dry-run mode for authorized requests", async () => {
    process.env.ADMIN_JOB_SECRET = "secret";

    const response = await GET(
      request("/api/admin/auto-match?maxAverageTierDelta=2", {
        authorization: "Bearer secret",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        dryRun: true,
        maxAverageTierDelta: 2,
        candidates: [{ leftPostId: "left-post", rightPostId: "right-post" }],
      },
    });
    expect(runAutoMatch).toHaveBeenCalledWith({ maxAverageTierDelta: 2 });
  });
});
