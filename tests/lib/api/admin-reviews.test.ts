import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchReviewsList, fetchReviewOrgs } from "@/lib/api/admin";

function mockOk(body: unknown) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }) as Response,
  );
}
afterEach(() => vi.restoreAllMocks());

describe("fetchReviewsList query string", () => {
  it("appends only the present, non-empty filters", async () => {
    mockOk({ schema_version: 1, items: [], total: 0, page: 2, size: 50 });
    await fetchReviewsList({ page: 2, size: 50, q: "auth", org: "acme", state: "failed" });
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } })
      .mock.calls;
    const url = calls[0]?.[0] as string;
    expect(url).toContain("/reviews?");
    expect(url).toContain("page=2");
    expect(url).toContain("q=auth");
    expect(url).toContain("org=acme");
    expect(url).toContain("state=failed");
    expect(url).not.toContain("repo=");
  });
});

describe("fetchReviewOrgs", () => {
  it("GETs /orgs and returns orgs", async () => {
    mockOk({ schema_version: 1, orgs: ["acme", "zeta"] });
    const res = await fetchReviewOrgs();
    expect(res.orgs).toEqual(["acme", "zeta"]);
  });
});
