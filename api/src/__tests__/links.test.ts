import { describe, it, expect, beforeEach } from "vitest";
import { request, prisma } from "./helpers";

describe("Links API", () => {
  beforeEach(async () => {
    await prisma.link.deleteMany({
      where: { slug: { startsWith: "test-" } },
    });
  });

  describe("POST /api/v1/links", () => {
    it("creates a link with valid data", async () => {
      const slug = "test-" + Date.now();
      const { status, data } = await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug,
      });

      expect(status).toBe(201);
      expect(data.data).toBeDefined();
      expect(data.data.slug).toBe(slug);
    });

    it("creates link with auto-generated slug", async () => {
      const { status, data } = await request("POST", "/api/v1/links", {
        url: "https://example.com",
      });

      expect(status).toBe(201);
      expect(data.data.slug.length).toBeGreaterThanOrEqual(8);
    });

    it("returns 400 for invalid URL", async () => {
      const { status } = await request("POST", "/api/v1/links", {
        url: "not-a-url",
      });

      expect(status).toBe(400);
    });

    it("returns 409 for duplicate slug", async () => {
      const slug = "test-dup-" + Date.now();
      await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug,
      });

      const { status } = await request("POST", "/api/v1/links", {
        url: "https://another.com",
        slug,
      });

      expect(status).toBe(409);
    });
  });

  describe("GET /api/v1/links", () => {
    it("returns list with pagination", async () => {
      const { status, data } = await request("GET", "/api/v1/links");

      expect(status).toBe(200);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.pagination).toBeDefined();
    });
  });

  describe("GET /api/v1/links/:slug", () => {
    it("returns link by slug", async () => {
      const slug = "test-get-" + Date.now();
      await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug,
      });

      const { status, data } = await request('get', `/api/v1/links/${slug}`);

      expect(status).toBe(200);
      expect(data.data.slug).toBe(slug);
    });

    it("returns 404 for non-existent slug", async () => {
      const { status, data } = await request(
        'get',
        "/api/v1/links/this-does-not-exist-12345"
      );

      expect(status).toBe(404);
    });
  });

  describe("PATCH /api/v1/links/:slug", () => {
    it("updates URL successfully", async () => {
      const slug = "test-patch-" + Date.now();
      await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug,
      });

      const { status, data } = await request(
        "PATCH",
        `/api/v1/links/${slug}`,
        { url: "https://updated.com" }
      );

      expect(status).toBe(200);
      expect(data.data.originalUrl).toBe("https://updated.com");
    });

    it("can deactivate link", async () => {
      const slug = "test-deactivate-" + Date.now();
      await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug,
      });

      const { status, data } = await request(
        "PATCH",
        `/api/v1/links/${slug}`,
        { isActive: false }
      );

      expect(status).toBe(200);
      expect(data.data.isActive).toBe(false);
    });

    it("returns 404 for non-existent link", async () => {
      const { status } = await request(
        "PATCH",
        "/api/v1/links/non-existent-123",
        { url: "https://test.com" }
      );

      expect(status).toBe(404);
    });
  });

  describe("DELETE /api/v1/links/:slug", () => {
    it("deletes link successfully", async () => {
      const slug = "test-delete-" + Date.now();
      await request("POST", "/api/v1/links", {
        url: "https://example.com",
        slug,
      });

      const { status } = await request("DELETE", `/api/v1/links/${slug}`);

      expect(status).toBe(200);

      const { status: notFound } = await request("GET", `/api/v1/links/${slug}`);
      expect(notFound).toBe(404);
    });

    it("returns 404 for non-existent slug", async () => {
      const { status } = await request("DELETE", "/api/v1/links/does-not-exist-123");

      expect(status).toBe(404);
    });
  });
});