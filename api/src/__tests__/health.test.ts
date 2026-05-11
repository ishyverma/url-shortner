import { describe, it, expect } from "vitest";
import { request } from "./helpers";

const BASE_URL = `http://localhost:${process.env.PORT || "3002"}`;

describe("Health & Root Endpoints", () => {
  describe("GET /", () => {
    it("returns API version and timestamp", async () => {
      const { status, data } = await request("GET", "/");

      expect(status).toBe(200);
      expect(data.message).toBe("URL Shortener API v1");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("GET /health", () => {
    it("returns ok with redis status", async () => {
      const { status, data } = await request("GET", "/health");

      expect(status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.redis).toBe("connected");
    });
  });
});