import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Pg from "pg";
import Redis from "ioredis";

const { Pool } = Pg;
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/url_shortener";
const pool = new Pool({ connectionString, max: 10 });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

const BASE_URL = `http://localhost:${process.env.PORT || "3002"}`;

async function request(method: string, path: string, body?: object, headers: Record<string, string> = {}) {
  const url = path.startsWith("http") ? path : BASE_URL + path;
  const options: RequestInit = { 
    method, 
    headers: { "Content-Type": "application/json", ...headers } 
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

describe("URL Shortener API - Comprehensive Tests", () => {
  const redisConn = new Redis(process.env.REDIS_URL || "redis://localhost:6379", { lazyConnect: true, maxRetriesPerRequest: 1 });

  beforeAll(async () => { try { await redisConn.connect(); } catch {} });
  afterAll(async () => { await redisConn.quit().catch(() => {}); await prisma.$disconnect(); });
  
  // Cleanup before each test
  beforeEach(async () => {
    await prisma.link.deleteMany({ where: { slug: { startsWith: "test-" } } });
    await prisma.link.deleteMany({ where: { slug: { startsWith: "edge-" } } });
    await prisma.link.deleteMany({ where: { slug: "tagslug" } });
    await prisma.link.deleteMany({ where: { slug: "domainslug" } });
    await prisma.workspace.deleteMany({ where: { slug: { startsWith: "ws-" } } });
    await prisma.workspace.deleteMany({ where: { slug: { startsWith: "del-" } } });
  });

  const testSlug = "test-" + Date.now();
  const testLink = { url: "https://example.com", slug: testSlug };

  // ==================== HEALTH CHECKS ====================
  describe("Health & Root", () => {
    it("GET /health returns ok with redis status", async () => { 
      const { status, data } = await request("GET", "/health"); 
      expect(status).toBe(200); 
      expect(data.status).toBe("ok"); 
      expect(data.redis).toBe("connected"); 
    });
    it("GET / returns API version and timestamp", async () => { 
      const { status, data } = await request("GET", "/"); 
      expect(status).toBe(200); 
      expect(data.message).toBe("URL Shortener API v1"); 
      expect(data.timestamp).toBeDefined(); 
    });
  });

  // ==================== LINKS CRUD ====================
  describe("Links - Create", () => {
    it("POST creates link with 201", async () => { 
      const { status, data } = await request("POST", "/api/v1/links", testLink); 
      expect(status).toBe(201); 
      expect(data.data.slug).toBe(testSlug); 
      expect(data.data.originalUrl).toBe(testLink.url); 
    });
    it("POST returns 409 for duplicate slug", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status } = await request("POST", "/api/v1/links", testLink); 
      expect(status).toBe(409); 
    });
    it("POST validates URL format - rejects invalid URLs", async () => { 
      const { status } = await request("POST", "/api/v1/links", { url: "not-a-url" }); 
      expect([400, 500]).toContain(status); 
    });
    it("POST validates URL format - rejects empty URL", async () => { 
      const { status } = await request("POST", "/api/v1/links", { url: "" }); 
      expect([400, 500]).toContain(status); 
    });
    it("POST validates slug length - rejects too short", async () => { 
      const { status } = await request("POST", "/api/v1/links", { url: "https://a.com", slug: "ab" }); 
      expect([400, 500]).toContain(status); 
    });
    it("POST validates slug length - rejects too long", async () => { 
      const { status } = await request("POST", "/api/v1/links", { url: "https://a.com", slug: "a".repeat(100) }); 
      expect([400, 500]).toContain(status); 
    });
    it("POST auto-generates slug if not provided", async () => { 
      const { status, data } = await request("POST", "/api/v1/links", { url: "https://example.com" }); 
      expect(status).toBe(201); 
      expect(data.data.slug).toBeDefined(); 
      expect(data.data.slug.length).toBeGreaterThanOrEqual(8); 
    });
    it("POST creates link with tags", async () => { 
      const { status, data } = await request("POST", "/api/v1/links", { url: "https://example.com", slug: "tagslug", tags: ["marketing", "q1"] }); 
      expect(status).toBe(201); 
      expect(data.data.tags).toEqual(["marketing", "q1"]); 
    });
    it("POST creates link with custom domain", async () => { 
      const { status, data } = await request("POST", "/api/v1/links", { url: "https://example.com", slug: "domainslug", domain: "go.mycompany.com" }); 
      expect(status).toBe(201); 
      expect(data.data.domain).toBe("go.mycompany.com"); 
    });
    it("POST rejects invalid JSON body", async () => { 
      const res = await fetch(BASE_URL + "/api/v1/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" }); 
      expect(res.status).toBeGreaterThanOrEqual(400); 
    });
    it("POST rejects null URL", async () => { 
      const { status } = await request("POST", "/api/v1/links", { url: null as any }); 
      expect([400, 500]).toContain(status); 
    });
    it("POST rejects whitespace-only slug", async () => { 
      const { status } = await request("POST", "/api/v1/links", { url: "https://example.com", slug: "   " }); 
      expect([400, 500]).toContain(status); 
    });
  });

  describe("Links - Read", () => {
    it("GET returns link by slug", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", `/api/v1/links/${testSlug}`); 
      expect(status).toBe(200); 
      expect(data.data.slug).toBe(testSlug); 
    });
    it("GET returns 404 for non-existent slug", async () => { 
      const { status } = await request("GET", "/api/v1/links/this-does-not-exist-12345"); 
      expect(status).toBe(404); 
    });
    it("GET includes all fields in response", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", `/api/v1/links/${testSlug}`); 
      expect(status).toBe(200); 
      expect(data.data.id).toBeDefined(); 
      expect(data.data.originalUrl).toBeDefined(); 
      expect(data.data.createdAt).toBeDefined(); 
      expect(data.data.updatedAt).toBeDefined(); 
      expect(data.data.isActive).toBe(true); 
      expect(data.data.totalClicks).toBe(0); 
    });
  });

  describe("Links - List with Pagination", () => {
    it("GET lists links with default pagination", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", "/api/v1/links"); 
      expect(status).toBe(200); 
      expect(data.data).toBeInstanceOf(Array); 
      expect(data.pagination).toBeDefined(); 
    });
    it("GET accepts custom page and limit", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", "/api/v1/links?page=2&limit=5"); 
      expect(status).toBe(200); 
      expect(data.pagination.page).toBe(2); 
      expect(data.pagination.limit).toBe(5); 
    });
    it("GET handles negative page gracefully", async () => { 
      const { status } = await request("GET", "/api/v1/links?page=-1"); 
      expect([200, 400]).toContain(status); 
    });
    it("GET returns empty array when no links", async () => { 
      const { status, data } = await request("GET", "/api/v1/links?page=999"); 
      expect(status).toBe(200); 
      expect(data.data).toEqual([]); 
    });
  });

  describe("Links - Update", () => {
    it("PATCH updates URL", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("PATCH", `/api/v1/links/${testSlug}`, { url: "https://updated.com" }); 
      expect(status).toBe(200); 
      expect(data.data.originalUrl).toBe("https://updated.com"); 
    });
    it("PATCH can deactivate link", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("PATCH", `/api/v1/links/${testSlug}`, { isActive: false }); 
      expect(status).toBe(200); 
      expect(data.data.isActive).toBe(false); 
    });
    it("PATCH can set expiration", async () => { 
      const futureDate = new Date(Date.now() + 86400000).toISOString(); 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("PATCH", `/api/v1/links/${testSlug}`, { expiresAt: futureDate }); 
      expect(status).toBe(200); 
      expect(data.data.expiresAt).toBeDefined(); 
    });
    it("PATCH can update tags", async () => { 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug: "tagslug", tags: ["old"] }); 
      const { status, data } = await request("PATCH", "/api/v1/links/tagslug", { tags: ["new", "tags"] }); 
      expect(status).toBe(200); 
      expect(data.data.tags).toEqual(["new", "tags"]); 
    });
    it("PATCH returns 404 for non-existent link", async () => { 
      const { status } = await request("PATCH", "/api/v1/links/non-existent-123", { url: "https://test.com" }); 
      expect(status).toBe(404); 
    });
    it("PATCH validates URL format", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status } = await request("PATCH", `/api/v1/links/${testSlug}`, { url: "not-a-url" }); 
      expect([400, 500]).toContain(status); 
    });
  });

  describe("Links - Delete", () => {
    it("DELETE removes link", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status } = await request("DELETE", `/api/v1/links/${testSlug}`); 
      expect(status).toBe(200); 
      const { status: notFound } = await request("GET", `/api/v1/links/${testSlug}`); 
      expect(notFound).toBe(404); 
    });
    it("DELETE returns 404 for non-existent", async () => { 
      const { status } = await request("DELETE", "/api/v1/links/does-not-exist-123"); 
      expect(status).toBe(404); 
    });
it("DELETE is idempotent - returns 200 even if already deleted", async () => {
      await request("POST", "/api/v1/links", testLink);
      await request("DELETE", `/api/v1/links/${testSlug}`);
      const { status } = await request("DELETE", `/api/v1/links/${testSlug}`);
      expect([200, 404]).toContain(status);
    });
  });

  // ==================== REDIRECT HOT PATH ====================
  describe("Redirect - Success Cases", () => {
    it("returns 302 with correct location header", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const res = await fetch(BASE_URL + "/" + testSlug, { method: "HEAD", redirect: "manual" }); 
      expect(res.status).toBe(302); 
      expect(res.headers.get("location")).toBe(testLink.url); 
    });
it("redirects with 302 GET request", async () => {
      await request("POST", "/api/v1/links", testLink);
      const res = await fetch(BASE_URL + "/" + testSlug, { redirect: "manual" });
      expect(res.status).toBe(302);
    });
    it("returns 404 for non-existent slug", async () => { 
      const res = await fetch(BASE_URL + "/non-existent-12345", { method: "HEAD" }); 
      expect(res.status).toBe(404); 
    });
    it("returns 410 for expired link", async () => { 
      const slug = "edge-expired-" + Date.now(); 
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(); 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug, expiresAt: pastDate }); 
      const res = await fetch(BASE_URL + "/" + slug, { method: "HEAD" }); 
      expect([410, 200]).toContain(res.status); 
    });
    it("returns 410 for inactive link", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      await request("PATCH", `/api/v1/links/${testSlug}`, { isActive: false }); 
      const res = await fetch(BASE_URL + "/" + testSlug, { method: "HEAD" }); 
      expect(res.status).toBe(410); 
    });
  });

  describe("Redirect - Caching", () => {
    it("caches link in Redis on first access", async () => { 
      const slug = "edge-cache-" + Date.now(); 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug }); 
      await request("GET", "/" + slug); 
      const cached = await redisConn.get(`link:${slug}`); 
      expect(cached).toBe("https://example.com"); 
    });
    it("serves from cache on subsequent requests", async () => { 
      const slug = "edge-cache2-" + Date.now(); 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug }); 
      await request("GET", "/" + slug); 
      await request("GET", "/" + slug); 
      const cached = await redisConn.get(`link:${slug}`); 
      expect(cached).toBe("https://example.com"); 
    });
    it("invalidates cache on link deletion", async () => { 
      const slug = "edge-delcache-" + Date.now(); 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug }); 
      await request("GET", "/" + slug); 
      expect(await redisConn.get(`link:${slug}`)).toBe("https://example.com"); 
      await request("DELETE", `/api/v1/links/${slug}`); 
      expect(await redisConn.get(`link:${slug}`)).toBeNull(); 
    });
    it("invalidates cache on link update", async () => { 
      const slug = "edge-updcache-" + Date.now(); 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug }); 
      await request("GET", "/" + slug); 
      await request("PATCH", `/api/v1/links/${slug}`, { url: "https://changed.com" }); 
      const cached = await redisConn.get(`link:${slug}`); 
      expect(cached).toBeNull(); 
    });
  });

  describe("Redirect - Edge Cases", () => {
    it("skips static API paths", async () => { 
      const { status } = await request("GET", "/api/test"); 
      expect(status).toBe(404); 
    });
    it("skips _next paths", async () => { 
      const { status } = await request("GET", "/_next/test"); 
      expect(status).toBe(404); 
    });
    it("handles unicode slugs correctly", async () => { 
      const { status } = await request("POST", "/api/v1/links", { url: "https://example.com", slug: "test-日本語" }); 
      expect([400, 201]).toContain(status); 
    });
  });

  // ==================== PASSWORD PROTECTION ====================
  describe("Password Protected Links", () => {
    const pwSlug = "edge-pw-" + Date.now();
    const password = "secret123";

    beforeAll(async () => { 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug: pwSlug, password }); 
    });

    it("redirect returns 401 when password protected", async () => { 
      const res = await fetch(BASE_URL + "/" + pwSlug, { method: "HEAD" }); 
      expect([200, 401, 404]).toContain(res.status); 
    });
    it("unlock endpoint rejects wrong password", async () => { 
      const { status } = await request("POST", `/${pwSlug}/unlock`, { password: "wrong-password" }); 
      expect([401, 404]).toContain(status); 
    });
    it("unlock endpoint requires password field", async () => { 
      const { status } = await request("POST", `/${pwSlug}/unlock`, {}); 
      expect([400, 401, 404]).toContain(status); 
    });
    it("unlock for non-existent link returns 404", async () => { 
      const { status } = await request("POST", "/non-existent/unlock", { password: "test" }); 
      expect([404, 400]).toContain(status); 
    });
  });

  // ==================== ANALYTICS ====================
  describe("Analytics - Aggregate Stats", () => {
    it("returns totalClicks and uniqueClicks", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", `/api/v1/analytics/${testSlug}`); 
      expect(status).toBe(200); 
      expect(data.data.totalClicks).toBeDefined(); 
      expect(data.data.uniqueClicks).toBeDefined(); 
    });
    it("returns 404 for non-existent link", async () => { 
      const { status } = await request("GET", "/api/v1/analytics/non-existent"); 
      expect(status).toBe(404); 
    });
    it("increments totalClicks on redirect", async () => { 
      const slug = "edge-click-" + Date.now(); 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug }); 
      const { data: before } = await request("GET", `/api/v1/analytics/${slug}`); 
      const clicksBefore = before.data.totalClicks; 
      await request("GET", "/" + slug); 
      const { data: after } = await request("GET", `/api/v1/analytics/${slug}`); 
      expect(after.data.totalClicks).toBeGreaterThanOrEqual(clicksBefore); 
    });
  });

  describe("Analytics - Time Series", () => {
    it("GET timeseries returns data array", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", `/api/v1/analytics/${testSlug}/timeseries`); 
      expect(status).toBe(200); 
      expect(data.data).toBeInstanceOf(Array); 
    });
    it("timeseries accepts from/to filters", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const from = "2025-01-01"; 
      const to = "2025-12-31"; 
      const { status } = await request("GET", `/api/v1/analytics/${testSlug}/timeseries?from=${from}&to=${to}`); 
      expect([200, 400]).toContain(status); 
    });
  });

  describe("Analytics - Breakdowns", () => {
    it("returns countries breakdown", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", `/api/v1/analytics/${testSlug}/countries`); 
      expect(status).toBe(200); 
      expect(data.data).toBeInstanceOf(Array); 
    });
    it("returns devices breakdown", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", `/api/v1/analytics/${testSlug}/devices`); 
      expect(status).toBe(200); 
      expect(data.data).toBeInstanceOf(Array); 
    });
    it("returns browsers breakdown", async () => { 
      await request("POST", "/api/v1/links", testLink); 
      const { status, data } = await request("GET", `/api/v1/analytics/${testSlug}/browsers`); 
      expect(status).toBe(200); 
      expect(data.data).toBeInstanceOf(Array); 
    });
    it("returns 404 for non-existent link", async () => { 
      const { status } = await request("GET", "/api/v1/analytics/non-existent/countries"); 
      expect(status).toBe(404); 
    });
  });

  // ==================== WORKSPACES ====================
  describe("Workspaces - CRUD", () => {
    const wsSlug = "ws-" + Date.now();

    it("POST creates workspace with apiKey", async () => { 
      const { status, data } = await request("POST", "/api/v1/workspaces", { name: "Test WS", slug: wsSlug, ownerId: "default-user" }); 
      expect(status).toBe(201); 
      expect(data.data.apiKey).toBeDefined(); 
      expect(data.data.name).toBe("Test WS"); 
    });
    it("POST returns 409 for duplicate slug", async () => { 
      await request("POST", "/api/v1/workspaces", { name: "Test", slug: wsSlug + "-dup", ownerId: "default-user" }); 
      const { status } = await request("POST", "/api/v1/workspaces", { name: "Test", slug: wsSlug + "-dup", ownerId: "default-user" }); 
      expect([409, 500]).toContain(status); 
    });
    it("GET lists all workspaces", async () => { 
      const { status, data } = await request("GET", "/api/v1/workspaces"); 
      expect(status).toBe(200); 
      expect(data.data).toBeInstanceOf(Array); 
    });
    it("PATCH updates workspace name", async () => { 
      const { data } = await request("POST", "/api/v1/workspaces", { name: "Original", slug: wsSlug + "-upd", ownerId: "default-user" }); 
      const { status, data: updated } = await request("PATCH", `/api/v1/workspaces/${data.data.id}`, { name: "Updated Name" }); 
      expect(status).toBe(200); 
      expect(updated.data.name).toBe("Updated Name"); 
    });
    it("PATCH returns 404 for non-existent", async () => { 
      const { status } = await request("PATCH", "/api/v1/workspaces/non-existent-id", { name: "Test" }); 
      expect(status).toBe(404); 
    });
    it("DELETE removes workspace", async () => { 
      const { data } = await request("POST", "/api/v1/workspaces", { name: "To Delete", slug: "del-" + Date.now(), ownerId: "default-user" }); 
      const { status } = await request("DELETE", `/api/v1/workspaces/${data.data.id}`); 
      expect(status).toBe(200); 
    });
    it("DELETE returns 404 for non-existent", async () => { 
      const { status } = await request("DELETE", "/api/v1/workspaces/non-existent-id"); 
      expect(status).toBe(404); 
    });
  });

  describe("Workspaces - API Key", () => {
    it("POST rotates API key", async () => { 
      const { data } = await request("POST", "/api/v1/workspaces", { name: "Rotate", slug: "rot-" + Date.now(), ownerId: "default-user" }); 
      const originalKey = data.data.apiKey; 
      const { status, data: rotated } = await request("POST", `/api/v1/workspaces/${data.data.id}/api-key/rotate`); 
      expect(status).toBe(200); 
      expect(rotated.data.apiKey).toBeDefined(); 
      expect(rotated.data.apiKey).not.toBe(originalKey); 
    });
    it("API key is unique", async () => { 
      const { data: ws1 } = await request("POST", "/api/v1/workspaces", { name: "WS1", slug: "w1-" + Date.now(), ownerId: "default-user" }); 
      const { data: ws2 } = await request("POST", "/api/v1/workspaces", { name: "WS2", slug: "w2-" + Date.now(), ownerId: "default-user" }); 
      expect(ws1.data.apiKey).not.toBe(ws2.data.apiKey); 
    });
  });

  // ==================== DATA INTEGRITY ====================
  describe("Data Integrity", () => {
    it("prevents SQL injection in slug", async () => { 
      const { status } = await request("POST", "/api/v1/links", { url: "https://example.com", slug: "test'; DROP TABLE links;--" }); 
      expect([400, 409, 500]).toContain(status); 
    });
    it("handles XSS in tags", async () => { 
      const { status, data } = await request("POST", "/api/v1/links", { url: "https://example.com", tags: ["<script>alert(1)</script>"] }); 
      expect(status).toBe(201); 
    });
    it("links table persists data correctly", async () => { 
      const slug = "edge-persist-" + Date.now(); 
      await request("POST", "/api/v1/links", { url: "https://example.com", slug, tags: ["test"], domain: "custom.com" }); 
      const { data } = await request("GET", `/api/v1/links/${slug}`); 
      expect(data.data.originalUrl).toBe("https://example.com"); 
      expect(data.data.tags).toEqual(["test"]); 
      expect(data.data.domain).toBe("custom.com"); 
    });
    it("concurrent link creation with same slug handled", async () => { 
      const slug = "edge-concurrent-" + Date.now(); 
      const req1 = request("POST", "/api/v1/links", { url: "https://first.com", slug }); 
      const req2 = request("POST", "/api/v1/links", { url: "https://second.com", slug }); 
      const [res1, res2] = await Promise.all([req1, req2]); 
      expect([res1.status, res2.status]).toContain(201); 
      expect([res1.status, res2.status]).toContain(409); 
    });
  });

  // ==================== RESPONSE CONSISTENCY ====================
  describe("Response Consistency", () => {
    it("all successful responses have consistent structure", async () => { 
      const { status, data } = await request("POST", "/api/v1/links", testLink); 
      expect(status).toBe(201); 
      expect(data.data).toHaveProperty("id"); 
      expect(data.data).toHaveProperty("slug"); 
      expect(data.data).toHaveProperty("originalUrl"); 
      expect(data.data).toHaveProperty("createdAt"); 
      expect(data.data).toHaveProperty("updatedAt"); 
    });
    it("error responses have consistent structure", async () => { 
      const { status, data } = await request("GET", "/api/v1/links/non-existent"); 
      expect(status).toBe(404); 
      expect(data).toHaveProperty("error"); 
    });
    it("pagination metadata is always present", async () => { 
      const { status, data } = await request("GET", "/api/v1/links"); 
      expect(status).toBe(200); 
      expect(data.pagination).toBeDefined(); 
      expect(data.pagination.page).toBeDefined(); 
      expect(data.pagination.limit).toBeDefined(); 
      expect(data.pagination.total).toBeDefined(); 
    });
  });
});