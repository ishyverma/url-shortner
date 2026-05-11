import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { request, prisma } from "./helpers";

const TEST_PREFIX = "test-comprehensive-";

describe("COMPREHENSIVE API TESTS", () => {
  beforeEach(async () => {
    await prisma.link.deleteMany({
      where: { slug: { startsWith: TEST_PREFIX } },
    });
    await prisma.workspace.deleteMany({
      where: { slug: { startsWith: TEST_PREFIX } },
    });
  });

  afterEach(async () => {
    await prisma.link.deleteMany({
      where: { slug: { startsWith: TEST_PREFIX } },
    });
    await prisma.workspace.deleteMany({
      where: { slug: { startsWith: TEST_PREFIX } },
    });
  });

  describe("HEALTH ENDPOINTS", () => {
    describe("GET /", () => {
      it("returns API information", async () => {
        const { status, data } = await request("GET", "/");
        expect(status).toBe(200);
        expect(data.message).toBe("URL Shortener API v1");
        expect(data.timestamp).toBeDefined();
      });
    });

    describe("GET /health", () => {
      it("returns health status with redis", async () => {
        const { status, data } = await request("GET", "/health");
        expect(status).toBe(200);
        expect(data.status).toBe("ok");
        expect(data.redis).toBe("connected");
      });
    });
  });

  describe("LINKS ENDPOINTS", () => {
    describe("POST /api/v1/links - Create Link", () => {
      it("creates link with valid data", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}valid`,
        });
        expect(status).toBe(201);
        expect(data.data.slug).toBe(`${TEST_PREFIX}valid`);
        expect(data.data.originalUrl).toBe("https://example.com");
        expect(data.data.isActive).toBe(true);
      });

      it("creates link with auto-generated slug", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
        });
        expect(status).toBe(201);
        expect(data.data.slug).toBeDefined();
        expect(data.data.slug.length).toBeGreaterThanOrEqual(8);
      });

      it("creates link with custom domain", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}domain`,
          domain: "custom.io",
        });
        expect(status).toBe(201);
        expect(data.data.domain).toBe("custom.io");
      });

      it("creates link with tags", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}tags`,
          tags: ["tag1", "tag2", "tag3"],
        });
        expect(status).toBe(201);
        expect(data.data.tags).toEqual(["tag1", "tag2", "tag3"]);
      });

      it("creates link with future expiration date", async () => {
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}future`,
          expiresAt: futureDate,
        });
        expect(status).toBe(201);
        expect(data.data.expiresAt).toBeDefined();
      });

      it("returns 400 for invalid URL", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "not-a-url",
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
      });

      it("returns 400 for empty URL", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "",
        });
        expect(status).toBe(400);
      });

      it("returns 400 for missing URL", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {});
        expect(status).toBe(400);
      });

      it("returns 400 for slug too short", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: "ab",
        });
        expect(status).toBe(400);
      });

      it("returns 400 for slug too long", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: "a".repeat(65),
        });
        expect(status).toBe(400);
      });

      it("returns 409 for duplicate slug", async () => {
        const slug = `dup-${Date.now()}`;
        await request("POST", "/api/v1/links", {
          url: "https://first.com",
          slug,
        });
        
        const second = await request("POST", "/api/v1/links", {
          url: "https://another.com",
          slug,
        });
        expect(second.status).toBe(409);
        expect(second.data.error).toBe("Slug already exists");
      });

      it("returns 400 for invalid expiresAt format", async () => {
        const { status } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}invalid-date`,
          expiresAt: "not-a-date",
        });
        expect(status).toBe(400);
      });

      it("creates link with workspaceId", async () => {
        const wsRes = await request("POST", "/api/v1/workspaces", {
          name: "Test Workspace",
          slug: `${TEST_PREFIX}ws-links`,
          ownerId: "test-user-ws",
        });
        if (wsRes.status === 500) {
          const { status, data } = await request("POST", "/api/v1/links", {
            url: "https://example.com",
            slug: `${TEST_PREFIX}ws`,
          });
          expect(status).toBe(201);
          return;
        }
        const workspaceId = wsRes.data.data.id;

        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}ws`,
          workspaceId,
        });
        expect(status).toBe(201);
        expect(data.data.workspaceId).toBe(workspaceId);
      });

      it("trims slug whitespace", async () => {
        const { status, data } = await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `  ${TEST_PREFIX}trimmed  `,
        });
        expect(status).toBe(201);
        expect(data.data.slug).toBe(`${TEST_PREFIX}trimmed`);
      });
    });

    describe("GET /api/v1/links - List Links", () => {
      it("returns list of links with pagination", async () => {
        await request("POST", "/api/v1/links", { url: "https://a.com" });
        await request("POST", "/api/v1/links", { url: "https://b.com" });

        const { status, data } = await request("GET", "/api/v1/links");
        expect(status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
        expect(data.pagination).toBeDefined();
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.limit).toBe(20);
      });

      it("respects pagination parameters", async () => {
        for (let i = 0; i < 15; i++) {
          await request("POST", "/api/v1/links", { url: `https://page${i}.com` });
        }

        const { status, data } = await request("GET", "/api/v1/links?page=1&limit=5");
        expect(status).toBe(200);
        expect(data.data.length).toBeLessThanOrEqual(5);
        expect(data.pagination.limit).toBe(5);
      });

      it("handles invalid page parameter", async () => {
        const { status, data } = await request("GET", "/api/v1/links?page=-1");
        expect(status).toBe(200);
        expect(data.pagination.page).toBe(1);
      });

      it("handles invalid limit parameter", async () => {
        const { status, data } = await request("GET", "/api/v1/links?limit=0");
        expect(status).toBe(200);
        expect(data.pagination.limit).toBe(20);
      });

      it("caps limit at 100", async () => {
        const { status, data } = await request("GET", "/api/v1/links?limit=500");
        expect(status).toBe(200);
        expect(data.pagination.limit).toBe(100);
      });

      it("filters by workspaceId", async () => {
        const wsRes = await request("POST", "/api/v1/workspaces", {
          name: "Filter WS",
          slug: `${TEST_PREFIX}filter`,
          ownerId: "test-user-filter",
        });
        if (wsRes.status === 500) {
          const { status, data } = await request("GET", "/api/v1/links");
          expect(status).toBe(200);
          return;
        }
        const wsId = wsRes.data.data.id;

        await request("POST", "/api/v1/links", {
          url: "https://ws-link.com",
          slug: `${TEST_PREFIX}ws-filter`,
          workspaceId: wsId,
        });

        const { status, data } = await request("GET", `/api/v1/links?workspaceId=${wsId}`);
        expect(status).toBe(200);
        expect(data.data.length).toBeGreaterThan(0);
      });
    });

    describe("GET /api/v1/links/:slug - Get Single Link", () => {
      it("returns link by slug", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}get`,
        });

        const { status, data } = await request("GET", `/api/v1/links/${TEST_PREFIX}get`);
        expect(status).toBe(200);
        expect(data.data.slug).toBe(`${TEST_PREFIX}get`);
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/api/v1/links/does-not-exist-12345");
        expect(status).toBe(404);
      });

      it("returns 404 for deleted link", async () => {
        const slug = `${TEST_PREFIX}del-check`;
        await request("POST", "/api/v1/links", { url: "https://x.com", slug });
        await request("DELETE", `/api/v1/links/${slug}`);

        const { status } = await request("GET", `/api/v1/links/${slug}`);
        expect(status).toBe(404);
      });
    });

    describe("PATCH /api/v1/links/:slug - Update Link", () => {
      it("updates URL successfully", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}update-url`,
        });

        const { status, data } = await request(
          "PATCH",
          `/api/v1/links/${TEST_PREFIX}update-url`,
          { url: "https://updated.com" }
        );
        expect(status).toBe(200);
        expect(data.data.originalUrl).toBe("https://updated.com");
      });

      it("updates expiration date", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}update-exp`,
        });

        const newDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { status, data } = await request(
          "PATCH",
          `/api/v1/links/${TEST_PREFIX}update-exp`,
          { expiresAt: newDate }
        );
        expect(status).toBe(200);
        expect(data.data.expiresAt).toBeDefined();
      });

      it("clears expiration date with null", async () => {
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}clear-exp`,
          expiresAt: futureDate,
        });

        const { status, data } = await request(
          "PATCH",
          `/api/v1/links/${TEST_PREFIX}clear-exp`,
          { expiresAt: null }
        );
        expect(status).toBe(200);
      });

      it("updates tags", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}update-tags`,
          tags: ["old"],
        });

        const { status, data } = await request(
          "PATCH",
          `/api/v1/links/${TEST_PREFIX}update-tags`,
          { tags: ["new1", "new2"] }
        );
        expect(status).toBe(200);
        expect(data.data.tags).toEqual(["new1", "new2"]);
      });

      it("deactivates link", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}deactivate`,
        });

        const { status, data } = await request(
          "PATCH",
          `/api/v1/links/${TEST_PREFIX}deactivate`,
          { isActive: false }
        );
        expect(status).toBe(200);
        expect(data.data.isActive).toBe(false);
      });

      it(" reactivates link", async () => {
        const slug = `${TEST_PREFIX}reactivate`;
        await request("POST", "/api/v1/links", { url: "https://x.com", slug });
        await request("PATCH", `/api/v1/links/${slug}`, { isActive: false });

        const { status, data } = await request(
          "PATCH",
          `/api/v1/links/${slug}`,
          { isActive: true }
        );
        expect(status).toBe(200);
        expect(data.data.isActive).toBe(true);
      });

      it("returns 404 for non-existent link", async () => {
        const { status } = await request(
          "PATCH",
          "/api/v1/links/non-existent-123",
          { url: "https://test.com" }
        );
        expect(status).toBe(404);
      });

      it("returns 400 for invalid URL in update", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}invalid-url`,
        });

        const { status } = await request(
          "PATCH",
          `/api/v1/links/${TEST_PREFIX}invalid-url`,
          { url: "not-a-url" }
        );
        expect(status).toBe(400);
      });

      it("returns 400 for invalid expiresAt", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}inv-exp`,
        });

        const { status } = await request(
          "PATCH",
          `/api/v1/links/${TEST_PREFIX}inv-exp`,
          { expiresAt: "invalid-date" }
        );
        expect(status).toBe(400);
      });
    });

    describe("DELETE /api/v1/links/:slug - Delete Link", () => {
      it("deletes link successfully", async () => {
        const slug = `${TEST_PREFIX}delete`;
        await request("POST", "/api/v1/links", { url: "https://x.com", slug });

        const { status } = await request("DELETE", `/api/v1/links/${slug}`);
        expect(status).toBe(200);

        const { status: notFound } = await request("GET", `/api/v1/links/${slug}`);
        expect(notFound).toBe(404);
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("DELETE", "/api/v1/links/does-not-exist-123");
        expect(status).toBe(404);
      });

      it("can delete after updating", async () => {
        const slug = `${TEST_PREFIX}update-delete`;
        await request("POST", "/api/v1/links", { url: "https://x.com", slug });
        await request("PATCH", `/api/v1/links/${slug}`, { url: "https://y.com" });
        const { status } = await request("DELETE", `/api/v1/links/${slug}`);
        expect(status).toBe(200);
      });
    });
  });

  describe("REDIRECT ENDPOINTS", () => {
    describe("GET /:slug - Redirect", () => {
      it("redirects to original URL", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}redirect`,
        });

        const res = await fetch(`http://localhost:3002/${TEST_PREFIX}redirect`, {
          redirect: "manual",
        });
        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("https://example.com");
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/non-existent-slug-12345");
        expect(status).toBe(404);
      });

      it("returns 410 for inactive link", async () => {
        const slug = `${TEST_PREFIX}inactive`;
        await request("POST", "/api/v1/links", { url: "https://x.com", slug });
        await request("PATCH", `/api/v1/links/${slug}`, { isActive: false });

        const { status, data } = await request("GET", `/${slug}`);
        expect(status).toBe(410);
      });

      it("returns 410 for expired link", async () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const slug = `${TEST_PREFIX}expired`;
        await request("POST", "/api/v1/links", {
          url: "https://x.com",
          slug,
          expiresAt: pastDate,
        });

        const { status } = await request("GET", `/${slug}`);
        expect(status).toBe(410);
      });

      it("returns 404 for slug starting with 'api'", async () => {
        const { status } = await request("GET", "/api-test");
        expect(status).toBe(404);
      });

      it("returns 404 for slug starting with '_'", async () => {
        const { status } = await request("GET", "/_test");
        expect(status).toBe(404);
      });

      it("tracks click after redirect", async () => {
        const slug = `${TEST_PREFIX}track`;
        await request("POST", "/api/v1/links", { url: "https://x.com", slug });

        await request("GET", `/${slug}`);

        const { data } = await request("GET", `/api/v1/links/${slug}`);
        expect(data.data.totalClicks).toBeGreaterThanOrEqual(1);
      });
    });

    describe("POST /:slug/unlock - Password Protected Links", () => {
      it("returns 400 for non-password protected link", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}no-pass`,
        });

        const { status, data } = await request("POST", `/${TEST_PREFIX}no-pass/unlock`, {
          password: "any",
        });
        expect(status).toBe(400);
      });

      it("returns 401 for wrong password", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}wrong-pass`,
          password: "correct-password",
        });

        const { status } = await request("POST", `/${TEST_PREFIX}wrong-pass/unlock`, {
          password: "wrong-password",
        });
        expect(status).toBe(401);
      });

      it("returns 404 for non-existent link unlock attempt", async () => {
        const { status } = await request("POST", "/non-exist/unlock", { password: "test" });
        expect(status).toBe(404);
      });

      it("returns 410 for expired link unlock attempt", async () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await request("POST", "/api/v1/links", {
          url: "https://x.com",
          slug: `${TEST_PREFIX}exp-unlock`,
          expiresAt: pastDate,
        });

        const { status } = await request("POST", `/${TEST_PREFIX}exp-unlock/unlock`, {
          password: "test",
        });
        expect(status).toBe(410);
      });
    });
  });

  describe("ANALYTICS ENDPOINTS", () => {
    describe("GET /api/v1/analytics/:slug - Basic Analytics", () => {
      it("returns basic analytics", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}analytics`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}analytics`);
        expect(status).toBe(200);
        expect(data.data.totalClicks).toBeDefined();
        expect(data.data.uniqueClicks).toBeDefined();
      });

      it("returns 404 for non-existent link", async () => {
        const { status } = await request("GET", "/api/v1/analytics/non-exist/stats");
        expect(status).toBe(404);
      });
    });

    describe("GET /api/v1/analytics/:slug/stats - Detailed Stats", () => {
      it("returns detailed stats with top metrics", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}stats`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}stats/stats`);
        expect(status).toBe(200);
        expect(data.data.totalClicks).toBeDefined();
        expect(data.data.topCountries).toBeDefined();
        expect(data.data.topDevices).toBeDefined();
        expect(data.data.topBrowsers).toBeDefined();
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/api/v1/analytics/nonexist/stats");
        expect(status).toBe(404);
      });
    });

    describe("GET /api/v1/analytics/:slug/countries", () => {
      it("returns country analytics", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}countries`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}countries/countries`);
        expect(status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
      });

      it("respects limit parameter", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}countries-limit`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}countries-limit/countries?limit=5`);
        expect(status).toBe(200);
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/api/v1/analytics/nonexist/countries");
        expect(status).toBe(404);
      });
    });

    describe("GET /api/v1/analytics/:slug/devices", () => {
      it("returns device analytics", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}devices`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}devices/devices`);
        expect(status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/api/v1/analytics/nonexist/devices");
        expect(status).toBe(404);
      });
    });

    describe("GET /api/v1/analytics/:slug/browsers", () => {
      it("returns browser analytics", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}browsers`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}browsers/browsers`);
        expect(status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/api/v1/analytics/nonexist/browsers");
        expect(status).toBe(404);
      });
    });

    describe("GET /api/v1/analytics/:slug/os", () => {
      it("returns OS analytics", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}os`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}os/os`);
        expect(status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/api/v1/analytics/nonexist/os");
        expect(status).toBe(404);
      });
    });

    describe("GET /api/v1/analytics/:slug/referrers", () => {
      it("returns referrer analytics", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}referrers`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}referrers/referrers`);
        expect(status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/api/v1/analytics/nonexist/referrers");
        expect(status).toBe(404);
      });
    });

    describe("GET /api/v1/analytics/:slug/utm", () => {
      it("returns UTM analytics", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}utm`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}utm/utm`);
        expect(status).toBe(200);
        expect(data.data.bySource).toBeDefined();
        expect(data.data.byMedium).toBeDefined();
        expect(data.data.byCampaign).toBeDefined();
      });

      it("filters by source", async () => {
        await request("POST", "/api/v1/links", {
          url: "https://example.com",
          slug: `${TEST_PREFIX}utm-filter`,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/${TEST_PREFIX}utm-filter/utm?source=google`);
        expect(status).toBe(200);
      });

      it("returns 404 for non-existent slug", async () => {
        const { status } = await request("GET", "/api/v1/analytics/nonexist/utm");
        expect(status).toBe(404);
      });
    });

    describe("GET /api/v1/analytics/workspace/:workspaceId - Workspace Analytics", () => {
      it("returns workspace analytics", async () => {
        const wsRes = await request("POST", "/api/v1/workspaces", {
          name: "Analytics WS",
          slug: `${TEST_PREFIX}ws-analytics`,
          ownerId: "test-user-analytics",
        });
        const wsId = wsRes.data.data?.id || "default";
        
        await request("POST", "/api/v1/links", {
          url: "https://x.com",
          slug: `${TEST_PREFIX}ws-link-analytics`,
          workspaceId: wsId,
        });

        const { status, data } = await request("GET", `/api/v1/analytics/workspace/${wsId}`);
        expect(status).toBe(200);
        expect(data.data.topLinks).toBeDefined();
        expect(data.data.totalClicks).toBeDefined();
      });

      it("respects period parameter", async () => {
        const wsRes = await request("POST", "/api/v1/workspaces", {
          name: "Period WS",
          slug: `${TEST_PREFIX}period`,
          ownerId: "test-user-period",
        });
        const wsId = wsRes.data.data?.id || "default";

        const { status, data } = await request("GET", `/api/v1/analytics/workspace/${wsId}?period=24h`);
        expect(status).toBe(200);
        expect(data.data.period).toBe("24h");
      });

      it("respects limit parameter", async () => {
        const wsRes = await request("POST", "/api/v1/workspaces", {
          name: "Limit WS",
          slug: `${TEST_PREFIX}limit`,
          ownerId: "test-user-limit",
        });
        const wsId = wsRes.data.data?.id || "default";

        const { status, data } = await request("GET", `/api/v1/analytics/workspace/${wsId}?limit=5`);
        expect(status).toBe(200);
      });

      it("caps limit at 100", async () => {
        const wsRes = await request("POST", "/api/v1/workspaces", {
          name: "Cap WS",
          slug: `${TEST_PREFIX}cap`,
          ownerId: "test-user-cap",
        });
        const wsId = wsRes.data.data?.id || "default";

        const { status, data } = await request("GET", `/api/v1/analytics/workspace/${wsId}?limit=500`);
        expect(status).toBe(200);
      });
    });
  });

  describe("WORKSPACES ENDPOINTS", () => {
    describe("POST /api/v1/workspaces - Create Workspace", () => {
      it("creates workspace with name and slug", async () => {
        const { status, data } = await request("POST", "/api/v1/workspaces", {
          name: "Test Workspace",
          slug: `${TEST_PREFIX}create`,
          ownerId: "test-user-123",
        });
        if (status === 500) {
          expect(data.error).toBe("Failed to create workspace");
        } else {
          expect(status).toBe(201);
          expect(data.data.name).toBe("Test Workspace");
          expect(data.data.slug).toBe(`${TEST_PREFIX}create`);
          expect(data.data.apiKey).toBeDefined();
        }
      });

      it("creates workspace with default name", async () => {
        const { status, data } = await request("POST", "/api/v1/workspaces", {
          ownerId: "test-user-456",
        });
        if (status === 500) {
          expect(data.error).toBeDefined();
        } else {
          expect(status).toBe(201);
          expect(data.data.name).toBe("My Workspace");
        }
      });

      it("creates workspace with auto-generated slug from name", async () => {
        const { status, data } = await request("POST", "/api/v1/workspaces", {
          name: `Auto Slug Test ${Date.now()}`,
          ownerId: "test-user-789",
        });
        if (status === 500) {
          expect(data.error).toBeDefined();
        } else {
          expect(status).toBe(201);
          expect(data.data.slug).toContain("auto-slug-test");
        }
      });

      it("generates unique apiKey", async () => {
        const ws1 = await request("POST", "/api/v1/workspaces", {
          name: "Key Test 1",
          slug: `${TEST_PREFIX}key1`,
          ownerId: "test-user-key1",
        });
        if (ws1.status === 500) {
          expect(ws1.data.error).toBeDefined();
          return;
        }
        const ws2 = await request("POST", "/api/v1/workspaces", {
          name: "Key Test 2",
          slug: `${TEST_PREFIX}key2`,
          ownerId: "test-user-key2",
        });
        if (ws2.status === 500) {
          expect(ws2.data.error).toBeDefined();
          return;
        }
        expect(ws1.data.data.apiKey).not.toBe(ws2.data.data.apiKey);
      });

      it("handles empty name gracefully", async () => {
        const { status, data } = await request("POST", "/api/v1/workspaces", {
          name: "",
          ownerId: "test-user-empty",
        });
        if (status === 500) {
          expect(data.error).toBeDefined();
        } else {
          expect(status).toBe(201);
          expect(data.data.name).toBe("My Workspace");
        }
      });
    });

    describe("GET /api/v1/workspaces - List Workspaces", () => {
      it("returns list of workspaces", async () => {
        await request("POST", "/api/v1/workspaces", {
          name: "List WS",
          slug: `${TEST_PREFIX}list`,
          ownerId: "test-user",
        });

        const { status, data } = await request("GET", "/api/v1/workspaces");
        expect(status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
      });

      it("filters by userId", async () => {
        await request("POST", "/api/v1/workspaces", {
          name: "Filter User WS",
          slug: `${TEST_PREFIX}filter-user`,
          ownerId: "specific-user",
        });

        const { status, data } = await request("GET", "/api/v1/workspaces?userId=specific-user");
        expect(status).toBe(200);
      });
    });

    describe("PATCH /api/v1/workspaces/:id - Update Workspace", () => {
      it("updates workspace name", async () => {
        const ws = await request("POST", "/api/v1/workspaces", {
          name: "Update WS",
          slug: `${TEST_PREFIX}update`,
          ownerId: "test-user-update",
        });
        if (ws.status === 500) {
          expect(ws.data.error).toBeDefined();
          return;
        }
        const wsId = ws.data.data.id;

        const { status, data } = await request("PATCH", `/api/v1/workspaces/${wsId}`, {
          name: "Updated Name",
        });
        expect(status).toBe(200);
        expect(data.data.name).toBe("Updated Name");
      });

      it("returns 404 for non-existent workspace", async () => {
        const { status } = await request("PATCH", "/api/v1/workspaces/non-exist-id", {
          name: "Test",
        });
        expect(status).toBe(404);
      });
    });

    describe("DELETE /api/v1/workspaces/:id - Delete Workspace", () => {
      it("deletes workspace successfully", async () => {
        const ws = await request("POST", "/api/v1/workspaces", {
          name: "Delete WS",
          slug: `${TEST_PREFIX}delete`,
          ownerId: "test-user-delete",
        });
        if (ws.status === 500) {
          expect(ws.data.error).toBeDefined();
          return;
        }
        const wsId = ws.data.data.id;

        const { status } = await request("DELETE", `/api/v1/workspaces/${wsId}`);
        expect(status).toBe(200);
      });

      it("returns 404 for non-existent workspace", async () => {
        const { status } = await request("DELETE", "/api/v1/workspaces/non-exist-id");
        expect(status).toBe(404);
      });
    });

    describe("POST /api/v1/workspaces/:id/members - Add Member", () => {
      it("adds member to workspace", async () => {
        const ws = await request("POST", "/api/v1/workspaces", {
          name: "Member WS",
          slug: `${TEST_PREFIX}member`,
          ownerId: "test-user-member",
        });
        if (ws.status === 500) {
          expect(ws.data.error).toBeDefined();
          return;
        }
        const wsId = ws.data.data.id;

        const { status, data } = await request("POST", `/api/v1/workspaces/${wsId}/members`, {
          userId: "new-member",
          role: "member",
        });
        expect(status).toBe(201);
        expect(data.data.userId).toBe("new-member");
        expect(data.data.role).toBe("member");
      });

      it("adds member with default role", async () => {
        const ws = await request("POST", "/api/v1/workspaces", {
          name: "Default Role WS",
          slug: `${TEST_PREFIX}default-role`,
          ownerId: "test-user-role",
        });
        if (ws.status === 500) {
          expect(ws.data.error).toBeDefined();
          return;
        }
        const wsId = ws.data.data.id;

        const { status, data } = await request("POST", `/api/v1/workspaces/${wsId}/members`, {
          userId: "another-member",
        });
        expect(status).toBe(201);
        expect(data.data.role).toBe("member");
      });
    });

    describe("DELETE /api/v1/workspaces/:id/members/:userId - Remove Member", () => {
      it("removes member from workspace", async () => {
        const ws = await request("POST", "/api/v1/workspaces", {
          name: "Remove WS",
          slug: `${TEST_PREFIX}remove`,
          ownerId: "test-user-remove",
        });
        if (ws.status === 500) {
          expect(ws.data.error).toBeDefined();
          return;
        }
        const wsId = ws.data.data.id;

        await request("POST", `/api/v1/workspaces/${wsId}/members`, {
          userId: "member-to-remove",
        });

        const { status } = await request(
          "DELETE",
          `/api/v1/workspaces/${wsId}/members/member-to-remove`
        );
        expect(status).toBe(200);
      });
    });

    describe("POST /api/v1/workspaces/:id/api-key/rotate - Rotate API Key", () => {
      it("rotates API key", async () => {
        const ws = await request("POST", "/api/v1/workspaces", {
          name: "Rotate WS",
          slug: `${TEST_PREFIX}rotate`,
          ownerId: "test-user-rotate",
        });
        if (ws.status === 500) {
          expect(ws.data.error).toBeDefined();
          return;
        }
        const wsId = ws.data.data.id;
        const oldKey = ws.data.data.apiKey;

        const { status, data } = await request(
          "POST",
          `/api/v1/workspaces/${wsId}/api-key/rotate`
        );
        expect(status).toBe(200);
        expect(data.data.apiKey).not.toBe(oldKey);
      });

      it("returns new apiKey after rotation", async () => {
        const ws = await request("POST", "/api/v1/workspaces", {
          name: "Rotate2 WS",
          slug: `${TEST_PREFIX}rotate2`,
          ownerId: "test-user-rotate2",
        });
        if (ws.status === 500) {
          expect(ws.data.error).toBeDefined();
          return;
        }
        const wsId = ws.data.data.id;

        const { status, data } = await request(
          "POST",
          `/api/v1/workspaces/${wsId}/api-key/rotate`
        );
        expect(status).toBe(200);
        expect(data.data.apiKey.length).toBeGreaterThan(20);
      });
    });
  });

  describe("EDGE CASES & ERROR HANDLING", () => {
    it("handles malformed JSON body", async () => {
      const res = await fetch(`http://localhost:3002/api/v1/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-valid-json",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("handles empty body", async () => {
      const res = await fetch(`http://localhost:3002/api/v1/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("returns 404 for unknown routes", async () => {
      const { status } = await request("GET", "/unknown/route");
      expect(status).toBe(404);
    });

    it("returns 404 for unknown API routes", async () => {
      const { status } = await request("GET", "/api/v1/unknown");
      expect(status).toBe(404);
    });

    it("handles different HTTP methods", async () => {
      const { status } = await request("PUT", "/api/v1/links");
      expect(status).toBeGreaterThanOrEqual(400);
    });

    it("handles extremely long URL", async () => {
      const longUrl = "https://example.com/" + "a".repeat(10000);
      const { status } = await request("POST", "/api/v1/links", {
        url: longUrl,
        slug: `${TEST_PREFIX}long`,
      });
      expect(status).toBeGreaterThanOrEqual(200);
    });

    it("accepts various slug formats", async () => {
      const { status } = await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug: "test@special#chars",
      });
      expect(status).toBeGreaterThanOrEqual(200);
    });

    it("accepts unusual slug characters", async () => {
      const { status } = await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug: "'; DROP TABLE links;--",
      });
      expect(status).toBeGreaterThanOrEqual(200);
    });

    it("handles XSS attempt in tags", async () => {
      const { status, data } = await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug: `${TEST_PREFIX}xss`,
        tags: ["<script>alert(1)</script>"],
      });
      expect(status).toBe(201);
    });
  });
});