import { Hono } from "hono";
import { prisma } from "../db/prisma";
import { redis } from "../db/redis";
import { logger } from "../lib/logger";

const redirect = new Hono();

// GET /:slug - Redirect hot path
redirect.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  // Skip static paths
  if (slug.startsWith("api") || slug.startsWith("_")) {
    return c.text("Not Found", 404);
  }

  try {
    // Try cache first
    let originalUrl = await redis.get(`link:${slug}`);

    if (!originalUrl) {
      // Cache miss - query database
      const link = await prisma.link.findUnique({
        where: { slug },
        select: { originalUrl: true, isActive: true, expiresAt: true, password: true },
      });

      if (!link) {
        return c.text("Not Found", 404);
      }

      if (!link.isActive) {
        return c.text("Gone", 410);
      }

      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return c.text("Gone", 410);
      }

      if (link.password) {
        // Return 401 to trigger client-side unlock flow
        return c.json({ error: "Password protected", requiresPassword: true, slug }, 401);
      }

      originalUrl = link.originalUrl;
      // Cache for 1 hour
      await redis.setex(`link:${slug}`, 3600, originalUrl);
    }

    // Track click (async, non-blocking)
    prisma.link.update({
      where: { slug },
      data: { totalClicks: { increment: 1 } },
    }).catch((err) => logger.error(err));

    // Redirect
    return c.redirect(originalUrl, 302);
  } catch (err) {
    logger.error(err);
    return c.text("Internal Server Error", 500);
  }
});

// POST /:slug/unlock - Unlock password-protected link
redirect.post("/:slug/unlock", async (c) => {
  const slug = c.req.param("slug");
  const { password } = await c.req.json();

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { originalUrl: true, password: true, isActive: true, expiresAt: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    if (!link.isActive || (link.expiresAt && new Date(link.expiresAt) < new Date())) {
      return c.json({ error: "Link expired" }, 410);
    }

    if (!link.password) {
      return c.json({ error: "Not password protected" }, 400);
    }

    // Import bcrypt dynamically
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, link.password);

    if (!valid) {
      return c.json({ error: "Invalid password" }, 401);
    }

    // Cache unlocked link for session
    await redis.setex(`link:unlocked:${slug}`, 3600, link.originalUrl);

    return c.json({ success: true, url: link.originalUrl });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to verify password" }, 500);
  }
});

export default redirect;