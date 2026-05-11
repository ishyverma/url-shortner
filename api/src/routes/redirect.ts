import { Hono, Context } from "hono";
import { prisma } from "../db/prisma";
import { redis } from "../db/redis";
import { enqueueClick } from "../db/queue";
import { parseClickContext } from "../lib/click-parser";
import { logger } from "../lib/logger";

interface LinkCache {
  id: string;
  workspaceId: string;
  originalUrl: string;
  isActive: boolean;
  expiresAt: string | null;
}

const redirect = new Hono();

async function getLink(slug: string): Promise<LinkCache | null> {
  const cached = await redis.get(`link:${slug}`);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.isActive === false) {
        return { ...parsed, isActive: false };
      }
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        return { ...parsed, isActive: false };
      }
      return parsed;
    } catch {
      return null;
    }
  }

  const link = await prisma.link.findUnique({
    where: { slug },
    select: { id: true, originalUrl: true, isActive: true, expiresAt: true, password: true, workspaceId: true },
  });

  if (!link) return null;

  const linkCache: LinkCache = { 
    id: link.id, 
    workspaceId: link.workspaceId, 
    originalUrl: link.originalUrl,
    isActive: link.isActive,
    expiresAt: link.expiresAt?.toISOString() || null
  };
  
  if (link.isActive && (!link.expiresAt || link.expiresAt > new Date())) {
    await redis.setex(`link:${slug}`, 3600, JSON.stringify(linkCache));
  }

  return linkCache;
}

redirect.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  if (slug.startsWith("api") || slug.startsWith("_")) {
    return c.text("Not Found", 404);
  }

  try {
    const link = await getLink(slug);

  if (!link) {
    return c.text("Not Found", 404);
  }

  if (!link.isActive) {
    return c.text("Gone", 410);
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return c.text("Gone", 410);
  }

  if (link.id) {
    enqueueClick({
      slug,
      linkId: link.id,
      workspaceId: link.workspaceId,
      ...parseClickContext(c),
    }).catch((err) => logger.error({ err, slug }, "Failed to enqueue click"));
  }

  return c.redirect(link.originalUrl, 302);
  } catch (err) {
    logger.error(err);
    return c.text("Internal Server Error", 500);
  }
});

redirect.post("/:slug/unlock", async (c) => {
  const slug = c.req.param("slug");
  const { password } = await c.req.json();

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true, originalUrl: true, password: true, isActive: true, expiresAt: true, workspaceId: true },
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

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, link.password);

    if (!valid) {
      return c.json({ error: "Invalid password" }, 401);
    }

    await redis.setex(`link:unlocked:${slug}`, 3600, link.originalUrl);

    return c.json({ success: true, url: link.originalUrl });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to verify password" }, 500);
  }
});

export default redirect;